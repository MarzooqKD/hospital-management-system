from rest_framework import serializers

from .models import Medication, Prescription, PrescriptionItem


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = ["id", "name", "generic_name", "form", "strength", "unit"]


class PrescriptionItemSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source="medication.name", read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = [
            "id",
            "medication",
            "medication_name",
            "dosage",
            "frequency",
            "duration_days",
            "instructions",
            "quantity_prescribed",
            "quantity_dispensed",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "medication_name",
            "quantity_dispensed",
            "status",
            "created_at",
        ]

    def validate(self, attrs):
        prescription = self.context["prescription"]
        if prescription.consultation.status != "in_progress":
            raise serializers.ValidationError(
                "Cannot add a prescription item to a completed consultation."
            )
        return attrs


class PrescriptionSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model = Prescription
        fields = [
            "id",
            "patient_name",
            "doctor",
            "doctor_name",
            "status",
            "notes",
            "items",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "patient_name",
            "doctor",
            "doctor_name",
            "status",
            "items",
            "created_at",
        ]

    def get_doctor_name(self, obj):
        name = f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return name or obj.doctor.email

    def get_patient_name(self, obj):
        p = obj.consultation.visit.patient
        return f"{p.first_name} {p.last_name}"


class DispenseSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)

    def validate_quantity(self, value):
        item = self.context["item"]
        remaining = item.quantity_prescribed - item.quantity_dispensed
        if value > remaining:
            raise serializers.ValidationError(
                f"Cannot dispense {value} — only {remaining} remaining on this prescription."
            )
        return value
