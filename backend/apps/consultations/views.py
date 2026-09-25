from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.appointments.models import Appointment
from apps.audit.utils import log_action
from apps.core.permissions import HasModulePermission
from apps.patients.models import Patient
from apps.queues.models import Queue, Visit

from .models import Consultation, Diagnosis, MedicalRecord, VitalSign
from .serializers import (
    ConsultationSerializer,
    DiagnosisSerializer,
    MedicalRecordSerializer,
    VitalSignSerializer,
)


def _get_visit_or_404(request, visit_id):
    """Hospital-scoped lookup — same IDOR-prevention pattern used
    throughout (apps.insurance, apps.patients.allergy_views)."""
    return get_object_or_404(Visit, pk=visit_id, hospital=request.user.hospital)


class VitalSignListCreateView(mixins.ListModelMixin, mixins.CreateModelMixin, GenericAPIView):
    serializer_class = VitalSignSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "vitals"

    def get_queryset(self):
        visit = _get_visit_or_404(self.request, self.kwargs["visit_id"])
        return VitalSign.objects.filter(visit=visit)

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def perform_create(self, serializer):
        visit = _get_visit_or_404(self.request, self.kwargs["visit_id"])
        serializer.save(hospital=visit.hospital, visit=visit, recorded_by=self.request.user)


class ConsultationDetailView(APIView):
    """Addressed by its Visit, not its own id — GET retrieves (404 until
    started), POST starts one, PATCH updates while in progress."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "consultation"

    def get(self, request, visit_id):
        visit = _get_visit_or_404(request, visit_id)
        consultation = get_object_or_404(Consultation, visit=visit)
        return Response(ConsultationSerializer(consultation).data)

    def post(self, request, visit_id):
        visit = _get_visit_or_404(request, visit_id)
        if Consultation.objects.filter(visit=visit).exists():
            return Response(
                {"detail": "This visit already has a consultation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ConsultationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save(hospital=visit.hospital, visit=visit, doctor=request.user)

        # Side effect, not a separate "queue" permission check — starting a
        # consultation is a "consultation" module action even though it also
        # moves the linked Queue entry forward (docs/RBAC.md: Doctor has no
        # direct edit grant on Queue).
        queue_entry = getattr(visit, "queue_entry", None)
        if queue_entry is not None and queue_entry.status == Queue.Status.WAITING:
            queue_entry.status = Queue.Status.IN_CONSULTATION
            queue_entry.called_at = timezone.now()
            queue_entry.doctor = request.user
            queue_entry.save(update_fields=["status", "called_at", "doctor", "updated_at"])

        log_action(
            actor=request.user,
            action="consultation_started",
            entity_type="consultation",
            entity_id=consultation.id,
            after=ConsultationSerializer(consultation).data,
            request=request,
        )
        return Response(ConsultationSerializer(consultation).data, status=status.HTTP_201_CREATED)

    def patch(self, request, visit_id):
        visit = _get_visit_or_404(request, visit_id)
        consultation = get_object_or_404(Consultation, visit=visit)
        if consultation.status == Consultation.Status.COMPLETED:
            return Response(
                {"detail": "This consultation is already completed and cannot be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        before = ConsultationSerializer(consultation).data
        serializer = ConsultationSerializer(consultation, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save()
        log_action(
            actor=request.user,
            action="consultation_updated",
            entity_type="consultation",
            entity_id=consultation.id,
            before=before,
            after=ConsultationSerializer(consultation).data,
            request=request,
        )
        return Response(ConsultationSerializer(consultation).data)


class ConsultationCompleteView(APIView):
    """Finalizes a consultation: requires at least one diagnosis, snapshots
    a MedicalRecord, and closes the Visit/Queue/Appointment chain."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "consultation"

    def post(self, request, visit_id):
        visit = _get_visit_or_404(request, visit_id)
        consultation = get_object_or_404(Consultation, visit=visit)
        if consultation.status == Consultation.Status.COMPLETED:
            return Response(
                {"detail": "This consultation is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not consultation.diagnoses.exists():
            return Response(
                {"detail": "Add at least one diagnosis before completing the consultation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            consultation.status = Consultation.Status.COMPLETED
            consultation.completed_at = timezone.now()
            consultation.save(update_fields=["status", "completed_at", "updated_at"])

            diagnosis_summary = "; ".join(
                f"{d.condition} ({d.get_diagnosis_type_display()})"
                for d in consultation.diagnoses.all()
            )
            medical_record = MedicalRecord.objects.create(
                hospital=visit.hospital,
                patient=visit.patient,
                visit=visit,
                visit_date=visit.created_at.date(),
                chief_complaint=consultation.chief_complaint,
                diagnosis_summary=diagnosis_summary,
                treatment_plan=consultation.treatment_plan,
                doctor=consultation.doctor,
            )

            visit.status = Visit.Status.CLOSED
            visit.closed_at = timezone.now()
            visit.save(update_fields=["status", "closed_at", "updated_at"])

            queue_entry = getattr(visit, "queue_entry", None)
            if queue_entry is not None and queue_entry.status != Queue.Status.CANCELLED:
                queue_entry.status = Queue.Status.COMPLETED
                queue_entry.completed_at = timezone.now()
                queue_entry.save(update_fields=["status", "completed_at", "updated_at"])

            if visit.appointment is not None:
                visit.appointment.status = Appointment.Status.COMPLETED
                visit.appointment.save(update_fields=["status", "updated_at"])

        log_action(
            actor=request.user,
            action="consultation_completed",
            entity_type="consultation",
            entity_id=consultation.id,
            after=ConsultationSerializer(consultation).data,
            request=request,
        )
        return Response(
            {
                "consultation": ConsultationSerializer(consultation).data,
                "medical_record": MedicalRecordSerializer(medical_record).data,
            }
        )


class DiagnosisListCreateView(mixins.ListModelMixin, mixins.CreateModelMixin, GenericAPIView):
    serializer_class = DiagnosisSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "consultation"

    def _get_consultation(self):
        return get_object_or_404(
            Consultation,
            pk=self.kwargs["consultation_id"],
            hospital=self.request.user.hospital,
        )

    def get_queryset(self):
        return Diagnosis.objects.filter(consultation=self._get_consultation())

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
        diagnosis = serializer.save(consultation=consultation, diagnosed_by=self.request.user)
        log_action(
            actor=self.request.user,
            action="diagnosis_created",
            entity_type="diagnosis",
            entity_id=diagnosis.id,
            after=DiagnosisSerializer(diagnosis).data,
            request=self.request,
        )


class MedicalRecordListView(ListAPIView):
    """Read-only — rows only ever appear as a side-effect of completing a
    Consultation. CLAUDE.md section 8 requires auditing "medical record
    access", not just its creation, so a read here is logged too."""

    serializer_class = MedicalRecordSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "consultation"

    def get_queryset(self):
        patient = get_object_or_404(
            Patient, pk=self.kwargs["patient_id"], hospital=self.request.user.hospital
        )
        return MedicalRecord.objects.filter(patient=patient)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        log_action(
            actor=request.user,
            action="medical_record_accessed",
            entity_type="patient",
            entity_id=self.kwargs["patient_id"],
            request=request,
        )
        return response
