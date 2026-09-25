from rest_framework import serializers

from .models import Referral

_ALLOWED_TRANSITIONS = {
    Referral.Status.PENDING: {Referral.Status.ACCEPTED, Referral.Status.CANCELLED},
    Referral.Status.ACCEPTED: {Referral.Status.COMPLETED, Referral.Status.CANCELLED},
    Referral.Status.COMPLETED: set(),
    Referral.Status.CANCELLED: set(),
}


class ReferralSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    referred_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Referral
        fields = [
            "id",
            "patient",
            "patient_name",
            "visit",
            "referral_type",
            "destination",
            "reason",
            "status",
            "referred_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "patient",
            "patient_name",
            "visit",
            "status",
            "referred_by_name",
            "created_at",
        ]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_referred_by_name(self, obj):
        name = f"{obj.referred_by.first_name} {obj.referred_by.last_name}".strip()
        return name or obj.referred_by.email


class ReferralStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Referral
        fields = ["status"]

    def validate_status(self, value):
        current = self.instance.status
        if value != current and value not in _ALLOWED_TRANSITIONS.get(current, set()):
            raise serializers.ValidationError(
                f"Cannot move a referral from '{current}' to '{value}'."
            )
        return value
