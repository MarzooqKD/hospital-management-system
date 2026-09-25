from django.utils import timezone
from rest_framework import serializers

from apps.consultations.models import Consultation

from .models import LaboratoryRequest, LaboratoryResult, LaboratoryTest

_ALLOWED_TRANSITIONS = {
    LaboratoryRequest.Status.REQUESTED: {
        LaboratoryRequest.Status.SAMPLE_COLLECTED,
        LaboratoryRequest.Status.CANCELLED,
    },
    LaboratoryRequest.Status.SAMPLE_COLLECTED: {LaboratoryRequest.Status.CANCELLED},
    LaboratoryRequest.Status.COMPLETED: set(),
    LaboratoryRequest.Status.CANCELLED: set(),
}


class LaboratoryTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LaboratoryTest
        fields = ["id", "name", "code", "category", "sample_type", "normal_range_text"]


class LaboratoryRequestSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    test_name = serializers.CharField(source="test.name", read_only=True)
    test_code = serializers.CharField(source="test.code", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    has_result = serializers.SerializerMethodField()

    class Meta:
        model = LaboratoryRequest
        fields = [
            "id",
            "patient",
            "patient_name",
            "consultation",
            "test",
            "test_name",
            "test_code",
            "status",
            "priority",
            "notes",
            "requested_by_name",
            "has_result",
            "sample_collected_at",
            "completed_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "patient",
            "consultation",
            "status",
            "requested_by_name",
            "has_result",
            "sample_collected_at",
            "completed_at",
            "created_at",
        ]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_requested_by_name(self, obj):
        name = f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip()
        return name or obj.requested_by.email

    def get_has_result(self, obj):
        return hasattr(obj, "result")

    def validate(self, attrs):
        consultation = self.context["consultation"]
        if consultation.status != Consultation.Status.IN_PROGRESS:
            raise serializers.ValidationError(
                "Cannot request a lab test on a completed consultation."
            )
        return attrs


class LaboratoryRequestUpdateSerializer(serializers.ModelSerializer):
    """Restricted to `status` — sample-collection / cancellation only."""

    class Meta:
        model = LaboratoryRequest
        fields = ["status"]

    def validate_status(self, value):
        current = self.instance.status
        if value != current and value not in _ALLOWED_TRANSITIONS.get(current, set()):
            raise serializers.ValidationError(
                f"Cannot move a lab request from '{current}' to '{value}'."
            )
        return value

    def update(self, instance, validated_data):
        new_status = validated_data.get("status", instance.status)
        if new_status == LaboratoryRequest.Status.SAMPLE_COLLECTED and instance.status != new_status:
            validated_data["sample_collected_at"] = timezone.now()
        return super().update(instance, validated_data)


class LaboratoryResultSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LaboratoryResult
        fields = [
            "id",
            "result_value",
            "is_abnormal",
            "notes",
            "performed_by_name",
            "validated_by_name",
            "validated_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "performed_by_name",
            "validated_by_name",
            "validated_at",
            "created_at",
        ]

    def get_performed_by_name(self, obj):
        name = f"{obj.performed_by.first_name} {obj.performed_by.last_name}".strip()
        return name or obj.performed_by.email

    def get_validated_by_name(self, obj):
        if not obj.validated_by:
            return None
        name = f"{obj.validated_by.first_name} {obj.validated_by.last_name}".strip()
        return name or obj.validated_by.email

    def to_representation(self, instance):
        """Doctor/patient access control (CLAUDE.md §6): a Lab Technician
        always sees the raw entry (they need it to validate/correct it),
        but any other role only sees the value once it's validated — an
        unconfirmed reading isn't shown as though it were final."""
        data = super().to_representation(instance)
        request = self.context.get("request")
        is_lab_tech = bool(
            request
            and request.user.is_authenticated
            and request.user.role
            and request.user.role.name == "lab_technician"
        )
        if not instance.validated_at and not is_lab_tech:
            data["result_value"] = None
            data["is_abnormal"] = None
            data["notes"] = ""
            data["pending_validation"] = True
        else:
            data["pending_validation"] = False
        return data

    def validate(self, attrs):
        request_obj = self.context["lab_request"]
        if request_obj.status != LaboratoryRequest.Status.SAMPLE_COLLECTED:
            raise serializers.ValidationError(
                "A result can only be entered after the sample has been collected."
            )
        return attrs
