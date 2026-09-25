from django.utils import timezone
from rest_framework import serializers

from apps.users.models import Role

from .models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_name",
            "department",
            "department_name",
            "doctor",
            "doctor_name",
            "scheduled_at",
            "duration_minutes",
            "status",
            "reason",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_doctor_name(self, obj):
        if not obj.doctor:
            return None
        return f"{obj.doctor.first_name} {obj.doctor.last_name}".strip() or obj.doctor.email

    def validate_department(self, value):
        request = self.context["request"]
        if value.hospital_id != request.user.hospital_id:
            raise serializers.ValidationError("Department does not belong to your hospital.")
        return value

    def validate_doctor(self, value):
        if value is None:
            return value
        request = self.context["request"]
        if value.hospital_id != request.user.hospital_id:
            raise serializers.ValidationError("Doctor does not belong to your hospital.")
        if value.role is None or value.role.name != Role.Name.DOCTOR:
            raise serializers.ValidationError("Selected user is not a doctor.")
        return value

    def validate_patient(self, value):
        request = self.context["request"]
        if value.hospital_id != request.user.hospital_id:
            raise serializers.ValidationError("Patient does not belong to your hospital.")
        if not value.is_active:
            raise serializers.ValidationError(
                "This patient has been deleted — restore them first before booking an appointment."
            )
        return value

    def validate_scheduled_at(self, value):
        if self.instance is None and value < timezone.now():
            raise serializers.ValidationError("Appointment time cannot be in the past.")
        return value

    def validate(self, attrs):
        doctor = attrs.get("doctor", getattr(self.instance, "doctor", None))
        scheduled_at = attrs.get("scheduled_at", getattr(self.instance, "scheduled_at", None))
        if doctor is not None and scheduled_at is not None:
            clashing = Appointment.objects.filter(
                doctor=doctor, scheduled_at=scheduled_at
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance is not None:
                clashing = clashing.exclude(pk=self.instance.pk)
            if clashing.exists():
                raise serializers.ValidationError(
                    "This doctor already has an appointment at that exact time."
                )
        return attrs
