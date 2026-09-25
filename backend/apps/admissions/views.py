from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.audit.utils import log_action
from apps.core.permissions import HasModulePermission
from apps.queues.models import Visit

from .models import Admission, Bed, Room, Ward
from .serializers import (
    AdmissionSerializer,
    BedSerializer,
    DischargeSerializer,
    RoomSerializer,
    TransferSerializer,
    WardSerializer,
)


class WardListCreateView(ListCreateAPIView):
    serializer_class = WardSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "admissions"

    def get_queryset(self):
        return Ward.objects.filter(hospital=self.request.user.hospital, is_active=True)

    def perform_create(self, serializer):
        serializer.save(hospital=self.request.user.hospital)


class RoomListCreateView(ListCreateAPIView):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "admissions"

    def get_queryset(self):
        return Room.objects.filter(
            ward__hospital=self.request.user.hospital, is_active=True
        ).select_related("ward")

    def perform_create(self, serializer):
        ward = serializer.validated_data["ward"]
        if ward.hospital_id != self.request.user.hospital_id:
            raise ValidationError({"ward": "Ward does not belong to your hospital."})
        serializer.save()


class BedListCreateView(ListCreateAPIView):
    serializer_class = BedSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "admissions"

    def get_queryset(self):
        qs = Bed.objects.filter(
            room__ward__hospital=self.request.user.hospital, is_active=True
        ).select_related("room__ward")
        if self.request.query_params.get("available") == "true":
            occupied_ids = Admission.objects.filter(
                status=Admission.Status.ADMITTED
            ).values_list("bed_id", flat=True)
            qs = qs.exclude(id__in=occupied_ids)
        return qs

    def perform_create(self, serializer):
        room = serializer.validated_data["room"]
        if room.ward.hospital_id != self.request.user.hospital_id:
            raise ValidationError({"room": "Room does not belong to your hospital."})
        serializer.save()


def _get_visit_or_404(request, visit_id):
    return get_object_or_404(Visit, pk=visit_id, hospital=request.user.hospital)


class VisitAdmissionDetailView(APIView):
    """Addressed by its Visit, like Consultation/Prescription/Invoice are —
    GET retrieves (404 until admitted), POST admits the patient to a bed."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "admissions"

    def get(self, request, visit_id):
        visit = _get_visit_or_404(request, visit_id)
        admission = get_object_or_404(Admission, visit=visit)
        return Response(AdmissionSerializer(admission).data)

    def post(self, request, visit_id):
        visit = _get_visit_or_404(request, visit_id)
        if Admission.objects.filter(visit=visit).exists():
            return Response(
                {"detail": "This visit already has an admission."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AdmissionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        admission = serializer.save(
            hospital=visit.hospital,
            patient=visit.patient,
            visit=visit,
            admitted_by=request.user,
        )
        log_action(
            actor=request.user,
            action="patient_admitted",
            entity_type="admission",
            entity_id=admission.id,
            after=AdmissionSerializer(admission).data,
            request=request,
        )
        return Response(AdmissionSerializer(admission).data, status=status.HTTP_201_CREATED)


class AdmissionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    """Flat, hospital-wide worklist — "who's currently admitted, where"."""

    serializer_class = AdmissionSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "admissions"

    def get_queryset(self):
        qs = Admission.objects.filter(hospital=self.request.user.hospital).select_related(
            "patient", "bed__room__ward"
        )
        if status_param := self.request.query_params.get("status"):
            qs = qs.filter(status=status_param)
        else:
            qs = qs.filter(status=Admission.Status.ADMITTED)
        return qs


def _get_admission_or_404(request, admission_id):
    return get_object_or_404(Admission, pk=admission_id, hospital=request.user.hospital)


class TransferView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "admissions"

    def post(self, request, admission_id):
        admission = _get_admission_or_404(request, admission_id)
        if admission.status != Admission.Status.ADMITTED:
            return Response(
                {"detail": "Only an active admission can be transferred."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = TransferSerializer(
            data=request.data, context={"request": request, "admission": admission}
        )
        serializer.is_valid(raise_exception=True)
        before_bed = admission.bed_id
        admission.bed = serializer.validated_data["bed"]
        admission.save(update_fields=["bed", "updated_at"])

        log_action(
            actor=request.user,
            action="admission_transferred",
            entity_type="admission",
            entity_id=admission.id,
            before={"bed": str(before_bed)},
            after={"bed": str(admission.bed_id)},
            request=request,
        )
        return Response(AdmissionSerializer(admission).data)


class DischargeView(APIView):
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "admissions"

    def post(self, request, admission_id):
        admission = _get_admission_or_404(request, admission_id)
        if admission.status == Admission.Status.DISCHARGED:
            return Response(
                {"detail": "This patient is already discharged."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DischargeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            discharge = serializer.save(admission=admission, discharged_by=request.user)
            admission.status = Admission.Status.DISCHARGED
            admission.save(update_fields=["status", "updated_at"])

        log_action(
            actor=request.user,
            action="patient_discharged",
            entity_type="admission",
            entity_id=admission.id,
            after=DischargeSerializer(discharge).data,
            request=request,
        )
        return Response(AdmissionSerializer(admission).data)
