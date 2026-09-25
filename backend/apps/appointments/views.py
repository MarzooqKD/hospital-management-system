from rest_framework import mixins, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.audit.utils import log_action
from apps.core.permissions import HasModulePermission

from .models import Appointment
from .serializers import AppointmentSerializer


class AppointmentViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    """"Delete" cancels rather than removing the row — appointment history
    (including cancellations) is reporting-relevant (CLAUDE.md section 6:
    no-show/cancellation analytics), so it is never actually deleted."""

    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "appointments"

    def get_queryset(self):
        qs = Appointment.objects.filter(
            hospital=self.request.user.hospital
        ).select_related("patient", "department", "doctor")

        params = self.request.query_params
        if department := params.get("department"):
            qs = qs.filter(department_id=department)
        if doctor := params.get("doctor"):
            qs = qs.filter(doctor_id=doctor)
        if date := params.get("date"):
            qs = qs.filter(scheduled_at__date=date)
        return qs

    def perform_create(self, serializer):
        appointment = serializer.save(
            hospital=self.request.user.hospital,
            created_by=self.request.user,
            status=Appointment.Status.SCHEDULED,
        )
        log_action(
            actor=self.request.user,
            action="appointment_created",
            entity_type="appointment",
            entity_id=appointment.id,
            after=AppointmentSerializer(appointment, context=self.get_serializer_context()).data,
            request=self.request,
        )

    def perform_update(self, serializer):
        before = AppointmentSerializer(
            serializer.instance, context=self.get_serializer_context()
        ).data
        appointment = serializer.save()
        log_action(
            actor=self.request.user,
            action="appointment_updated",
            entity_type="appointment",
            entity_id=appointment.id,
            before=before,
            after=AppointmentSerializer(appointment, context=self.get_serializer_context()).data,
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        appointment = self.get_object()
        appointment.status = Appointment.Status.CANCELLED
        appointment.save(update_fields=["status", "updated_at"])
        log_action(
            actor=request.user,
            action="appointment_cancelled",
            entity_type="appointment",
            entity_id=appointment.id,
            request=request,
        )
        return Response(
            AppointmentSerializer(appointment, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )
