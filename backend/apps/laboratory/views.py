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

from .models import LaboratoryRequest, LaboratoryResult, LaboratoryTest
from .serializers import (
    LaboratoryRequestSerializer,
    LaboratoryRequestUpdateSerializer,
    LaboratoryResultSerializer,
    LaboratoryTestSerializer,
)


class LaboratoryTestListView(ListAPIView):
    """Reference catalogue — any authenticated user with `laboratory.view`
    (Doctor/Nurse need it to place an order)."""

    serializer_class = LaboratoryTestSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "laboratory"

    def get_queryset(self):
        return LaboratoryTest.objects.filter(is_active=True)


class ConsultationLabRequestListCreateView(
    mixins.ListModelMixin, mixins.CreateModelMixin, GenericAPIView
):
    """Nested under a Consultation — this is how a diagnosis "triggers" a
    lab request in the UI: the doctor orders it from the consultation
    workspace they're already in."""

    serializer_class = LaboratoryRequestSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "laboratory"

    def _get_consultation(self):
        return get_object_or_404(
            Consultation,
            pk=self.kwargs["consultation_id"],
            hospital=self.request.user.hospital,
        )

    def get_queryset(self):
        return LaboratoryRequest.objects.filter(consultation=self._get_consultation())

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["consultation"] = self._get_consultation()
        return context

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def perform_create(self, serializer):
        consultation = self._get_consultation()
        lab_request = serializer.save(
            hospital=consultation.hospital,
            patient=consultation.visit.patient,
            consultation=consultation,
            requested_by=self.request.user,
        )
        log_action(
            actor=self.request.user,
            action="lab_request_created",
            entity_type="lab_request",
            entity_id=lab_request.id,
            after=LaboratoryRequestSerializer(lab_request).data,
            request=self.request,
        )


class LaboratoryRequestViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, GenericViewSet
):
    """Flat, hospital-wide worklist for Lab Technicians — not scoped to a
    consultation, since a technician processes samples as they arrive
    across the whole department."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "laboratory"

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return LaboratoryRequestUpdateSerializer
        return LaboratoryRequestSerializer

    def get_queryset(self):
        qs = LaboratoryRequest.objects.filter(
            hospital=self.request.user.hospital
        ).select_related("patient", "test", "requested_by")
        if status_param := self.request.query_params.get("status"):
            qs = qs.filter(status=status_param)
        return qs

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)
        before_status = instance.status
        lab_request = serializer.save()
        if lab_request.status != before_status:
            log_action(
                actor=request.user,
                action="lab_request_status_changed",
                entity_type="lab_request",
                entity_id=lab_request.id,
                before={"status": before_status},
                after={"status": lab_request.status},
                request=request,
            )
        return Response(
            LaboratoryRequestSerializer(lab_request, context=self.get_serializer_context()).data
        )


def _get_lab_request_or_404(request, request_id):
    return get_object_or_404(LaboratoryRequest, pk=request_id, hospital=request.user.hospital)


class LaboratoryResultView(APIView):
    """GET retrieves (subject to the validation-gated visibility in the
    serializer), POST records the raw result — requires the sample to
    already be marked collected."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "laboratory"

    def get(self, request, request_id):
        lab_request = _get_lab_request_or_404(request, request_id)
        result = get_object_or_404(LaboratoryResult, request=lab_request)
        return Response(
            LaboratoryResultSerializer(result, context={"request": request}).data
        )

    def post(self, request, request_id):
        lab_request = _get_lab_request_or_404(request, request_id)
        if LaboratoryResult.objects.filter(request=lab_request).exists():
            return Response(
                {"detail": "A result has already been entered for this request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = LaboratoryResultSerializer(
            data=request.data, context={"request": request, "lab_request": lab_request}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save(request=lab_request, performed_by=request.user)
        log_action(
            actor=request.user,
            action="lab_result_recorded",
            entity_type="lab_result",
            entity_id=result.id,
            after=LaboratoryResultSerializer(result, context={"request": request}).data,
            request=request,
        )
        return Response(
            LaboratoryResultSerializer(result, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class LaboratoryResultValidateView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "laboratory"

    def post(self, request, request_id):
        lab_request = _get_lab_request_or_404(request, request_id)
        result = get_object_or_404(LaboratoryResult, request=lab_request)
        if result.validated_at is not None:
            return Response(
                {"detail": "This result is already validated."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result.validated_by = request.user
        result.validated_at = timezone.now()
        result.save(update_fields=["validated_by", "validated_at"])
        lab_request.status = LaboratoryRequest.Status.COMPLETED
        lab_request.completed_at = timezone.now()
        lab_request.save(update_fields=["status", "completed_at", "updated_at"])

        log_action(
            actor=request.user,
            action="lab_result_validated",
            entity_type="lab_result",
            entity_id=result.id,
            request=request,
        )
        return Response(LaboratoryResultSerializer(result, context={"request": request}).data)
