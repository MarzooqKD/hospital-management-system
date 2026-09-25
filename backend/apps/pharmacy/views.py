from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.audit.utils import log_action
from apps.consultations.models import Consultation
from apps.core.permissions import HasModulePermission
from apps.inventory.models import InventoryItem, InventoryTransaction

from .models import Medication, Prescription, PrescriptionItem
from .serializers import (
    DispenseSerializer,
    MedicationSerializer,
    PrescriptionItemSerializer,
    PrescriptionSerializer,
)


class MedicationListView(ListAPIView):
    serializer_class = MedicationSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "pharmacy"
    filter_backends = []

    def get_queryset(self):
        qs = Medication.objects.filter(is_active=True)
        if search := self.request.query_params.get("search"):
            qs = qs.filter(name__icontains=search)
        return qs


def _get_consultation_or_404(request, consultation_id):
    return get_object_or_404(
        Consultation, pk=consultation_id, hospital=request.user.hospital
    )


class ConsultationPrescriptionDetailView(APIView):
    """Addressed by its Consultation, like ConsultationDetailView is
    addressed by its Visit — GET retrieves (404 until started), POST
    starts one. One Prescription per Consultation."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "pharmacy"

    def get(self, request, consultation_id):
        consultation = _get_consultation_or_404(request, consultation_id)
        prescription = get_object_or_404(Prescription, consultation=consultation)
        return Response(PrescriptionSerializer(prescription).data)

    def post(self, request, consultation_id):
        consultation = _get_consultation_or_404(request, consultation_id)
        if Prescription.objects.filter(consultation=consultation).exists():
            return Response(
                {"detail": "This consultation already has a prescription."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        prescription = Prescription.objects.create(
            hospital=consultation.hospital, consultation=consultation, doctor=request.user
        )
        log_action(
            actor=request.user,
            action="prescription_created",
            entity_type="prescription",
            entity_id=prescription.id,
            after=PrescriptionSerializer(prescription).data,
            request=request,
        )
        return Response(PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED)


def _get_prescription_or_404(request, prescription_id):
    return get_object_or_404(
        Prescription, pk=prescription_id, hospital=request.user.hospital
    )


class PrescriptionItemListCreateView(
    mixins.ListModelMixin, mixins.CreateModelMixin, GenericAPIView
):
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "pharmacy"

    def get_queryset(self):
        return PrescriptionItem.objects.filter(
            prescription=_get_prescription_or_404(self.request, self.kwargs["prescription_id"])
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["prescription"] = _get_prescription_or_404(
            self.request, self.kwargs["prescription_id"]
        )
        return context

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def perform_create(self, serializer):
        prescription = _get_prescription_or_404(self.request, self.kwargs["prescription_id"])
        item = serializer.save(prescription=prescription)
        log_action(
            actor=self.request.user,
            action="prescription_item_added",
            entity_type="prescription_item",
            entity_id=item.id,
            after=PrescriptionItemSerializer(item).data,
            request=self.request,
        )


class PrescriptionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    """Flat, hospital-wide worklist for Pharmacists — not scoped to a
    consultation, mirroring LaboratoryRequestViewSet."""

    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "pharmacy"

    def get_queryset(self):
        qs = Prescription.objects.filter(
            hospital=self.request.user.hospital
        ).select_related("consultation__visit__patient", "doctor")
        if status_param := self.request.query_params.get("status"):
            qs = qs.filter(status=status_param)
        return qs


def _recompute_prescription_status(prescription):
    statuses = list(prescription.items.values_list("status", flat=True))
    if not statuses:
        return
    if all(s == PrescriptionItem.Status.DISPENSED for s in statuses):
        new_status = Prescription.Status.DISPENSED
    elif any(s == PrescriptionItem.Status.DISPENSED for s in statuses):
        new_status = Prescription.Status.PARTIALLY_DISPENSED
    else:
        new_status = Prescription.Status.PENDING
    if prescription.status != new_status:
        prescription.status = new_status
        prescription.save(update_fields=["status", "updated_at"])


class DispenseItemView(APIView):
    """Dispensing is a `pharmacy` action (Pharmacist holds
    pharmacy.create), but it also decrements real stock — an `inventory`
    side effect, same pattern as Phase 2's "starting a consultation moves
    the Queue entry" (docs/RBAC.md). Protects against over-dispensing on
    two axes: against what's left on the prescription (DispenseSerializer)
    and against what's actually in stock (checked here, under a row lock)."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "pharmacy"

    def post(self, request, prescription_id, item_id):
        prescription = _get_prescription_or_404(request, prescription_id)
        item = get_object_or_404(PrescriptionItem, pk=item_id, prescription=prescription)
        if item.status == PrescriptionItem.Status.CANCELLED:
            return Response(
                {"detail": "This item was cancelled and cannot be dispensed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DispenseSerializer(data=request.data, context={"item": item})
        serializer.is_valid(raise_exception=True)
        quantity = serializer.validated_data["quantity"]

        inventory_item = InventoryItem.objects.filter(
            hospital=prescription.hospital, medication=item.medication
        ).first()
        if inventory_item is None:
            return Response(
                {"detail": "No stock record exists for this medication."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            locked_item = InventoryItem.objects.select_for_update().get(pk=inventory_item.pk)
            if locked_item.quantity_on_hand < quantity:
                return Response(
                    {
                        "detail": f"Only {locked_item.quantity_on_hand} {locked_item.unit} in "
                        "stock — cannot dispense that quantity."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            InventoryTransaction.objects.create(
                hospital=locked_item.hospital,
                item=locked_item,
                transaction_type=InventoryTransaction.TransactionType.ISSUED,
                quantity_change=-quantity,
                dispensed_prescription_item=item,
                performed_by=request.user,
            )
            locked_item.quantity_on_hand -= quantity
            locked_item.save(update_fields=["quantity_on_hand", "updated_at"])

            item.quantity_dispensed += quantity
            item.status = (
                PrescriptionItem.Status.DISPENSED
                if item.quantity_dispensed >= item.quantity_prescribed
                else PrescriptionItem.Status.PENDING
            )
            item.dispensed_by = request.user
            item.dispensed_at = timezone.now()
            item.save(
                update_fields=[
                    "quantity_dispensed",
                    "status",
                    "dispensed_by",
                    "dispensed_at",
                    "updated_at",
                ]
            )
            _recompute_prescription_status(prescription)

        log_action(
            actor=request.user,
            action="medication_dispensed",
            entity_type="prescription_item",
            entity_id=item.id,
            after=PrescriptionItemSerializer(item).data,
            request=request,
        )
        return Response(PrescriptionItemSerializer(item).data)
