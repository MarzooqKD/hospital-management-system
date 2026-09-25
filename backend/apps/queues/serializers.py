from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.appointments.models import Appointment
from apps.core.models import Department
from apps.patients.models import Patient
from apps.users.models import Role

from .models import Queue, Visit, generate_queue_number

_ALLOWED_TRANSITIONS = {
    Queue.Status.WAITING: {Queue.Status.IN_CONSULTATION, Queue.Status.CANCELLED},
    Queue.Status.IN_CONSULTATION: {Queue.Status.COMPLETED, Queue.Status.CANCELLED},
    Queue.Status.COMPLETED: set(),
    Queue.Status.CANCELLED: set(),
}


class VisitSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField(source="patient.id", read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_number = serializers.CharField(source="patient.patient_number", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Visit
        fields = [
            "id",
            "patient_id",
            "patient_name",
            "patient_number",
            "department_name",
            "status",
            "created_at",
            "closed_at",
        ]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"


class QueueSerializer(serializers.ModelSerializer):
    visit_id = serializers.UUIDField(source="visit.id", read_only=True)
    patient_id = serializers.UUIDField(source="visit.patient_id", read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_number = serializers.CharField(source="visit.patient.patient_number", read_only=True)
    department_name = serializers.CharField(source="visit.department.name", read_only=True)
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = Queue
        fields = [
            "id",
            "visit_id",
            "patient_id",
            "patient_name",
            "patient_number",
            "department_name",
            "doctor",
            "doctor_name",
            "queue_number",
            "priority",
            "status",
            "called_at",
            "completed_at",
            "created_at",
        ]
        read_only_fields = ["id", "queue_number", "called_at", "completed_at", "created_at"]

    def get_patient_name(self, obj):
        p = obj.visit.patient
        return f"{p.first_name} {p.last_name}"

    def get_doctor_name(self, obj):
        if not obj.doctor:
            return None
        return f"{obj.doctor.first_name} {obj.doctor.last_name}".strip() or obj.doctor.email


class QueueUpdateSerializer(serializers.ModelSerializer):
    """Restricted to `status`/`doctor` — everything else about a queue
    entry is fixed at check-in time."""

    class Meta:
        model = Queue
        fields = ["status", "doctor"]

    def validate_status(self, value):
        current = self.instance.status
        if value != current and value not in _ALLOWED_TRANSITIONS.get(current, set()):
            raise serializers.ValidationError(
                f"Cannot move a queue entry from '{current}' to '{value}'."
            )
        return value

    def validate_doctor(self, value):
        if value is None:
            return value
        if value.hospital_id != self.instance.hospital_id:
            raise serializers.ValidationError("Doctor does not belong to this hospital.")
        if value.role is None or value.role.name != Role.Name.DOCTOR:
            raise serializers.ValidationError("Selected user is not a doctor.")
        return value

    def update(self, instance, validated_data):
        new_status = validated_data.get("status", instance.status)
        if new_status != instance.status:
            if new_status == Queue.Status.IN_CONSULTATION:
                validated_data["called_at"] = timezone.now()
            elif new_status == Queue.Status.COMPLETED:
                validated_data["completed_at"] = timezone.now()
        return super().update(instance, validated_data)


class CheckInSerializer(serializers.Serializer):
    """Not a ModelSerializer — a check-in creates Visit + Queue (and
    updates Appointment) together, not one row on one model."""

    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    appointment = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), required=False, allow_null=True
    )
    priority = serializers.ChoiceField(
        choices=Queue.Priority.choices, default=Queue.Priority.NORMAL
    )

    def validate_patient(self, value):
        if value.hospital_id != self.context["request"].user.hospital_id:
            raise serializers.ValidationError("Patient does not belong to your hospital.")
        if not value.is_active:
            raise serializers.ValidationError(
                "This patient has been deleted — restore them first before checking them in."
            )
        return value

    def validate_department(self, value):
        if value.hospital_id != self.context["request"].user.hospital_id:
            raise serializers.ValidationError("Department does not belong to your hospital.")
        return value

    def validate_appointment(self, value):
        if value is None:
            return value
        if value.hospital_id != self.context["request"].user.hospital_id:
            raise serializers.ValidationError("Appointment does not belong to your hospital.")
        if value.status not in (Appointment.Status.SCHEDULED, Appointment.Status.CONFIRMED):
            raise serializers.ValidationError(
                "This appointment cannot be checked in (already checked in, cancelled, or completed)."
            )
        return value

    def validate(self, attrs):
        patient = attrs["patient"]
        if Visit.objects.filter(patient=patient, status=Visit.Status.ACTIVE).exists():
            raise serializers.ValidationError("This patient already has an active visit.")
        appointment = attrs.get("appointment")
        if appointment is not None and appointment.patient_id != patient.id:
            raise serializers.ValidationError("Appointment does not belong to this patient.")
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        patient = validated_data["patient"]
        department = validated_data["department"]
        appointment = validated_data.get("appointment")
        priority = validated_data["priority"]

        with transaction.atomic():
            visit = Visit.objects.create(
                hospital=request.user.hospital,
                patient=patient,
                department=department,
                appointment=appointment,
                created_by=request.user,
            )
            queue_entry = Queue.objects.create(
                hospital=request.user.hospital,
                visit=visit,
                doctor=appointment.doctor if appointment else None,
                queue_number=generate_queue_number(request.user.hospital, department),
                priority=priority,
            )
            if appointment is not None:
                appointment.status = Appointment.Status.CHECKED_IN
                appointment.save(update_fields=["status", "updated_at"])
        return queue_entry
