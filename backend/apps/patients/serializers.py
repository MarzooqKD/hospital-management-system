from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.core.validators import normalize_ghana_phone

from .models import Patient


class PatientListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            "id",
            "patient_number",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "phone",
            "is_active",
        ]


class PatientDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            "id",
            "patient_number",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "ghana_card_number",
            "nhis_number",
            "phone",
            "alt_phone",
            "email",
            "address_region",
            "address_district",
            "address_town",
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
            "blood_group",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "patient_number", "created_at", "updated_at"]

    def _normalize_phone(self, value):
        try:
            return normalize_ghana_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)

    def validate_phone(self, value):
        return self._normalize_phone(value)

    def validate_alt_phone(self, value):
        return self._normalize_phone(value) if value else value

    def validate_emergency_contact_phone(self, value):
        return self._normalize_phone(value) if value else value

    def validate_ghana_card_number(self, value):
        if not value:
            return value

        hospital = self.context["request"].user.hospital
        existing = Patient.objects.filter(hospital=hospital, ghana_card_number=value)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError(
                "A patient with this Ghana Card number is already registered at this hospital."
            )
        return value
