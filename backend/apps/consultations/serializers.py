from rest_framework import serializers

from .models import Consultation, Diagnosis, MedicalRecord, VitalSign


class VitalSignSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VitalSign
        fields = [
            "id",
            "temperature_celsius",
            "blood_pressure_systolic",
            "blood_pressure_diastolic",
            "pulse_bpm",
            "respiratory_rate",
            "spo2_percent",
            "weight_kg",
            "height_cm",
            "bmi",
            "notes",
            "recorded_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "bmi", "recorded_by_name", "created_at"]

    def get_recorded_by_name(self, obj):
        name = f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip()
        return name or obj.recorded_by.email


class DiagnosisSerializer(serializers.ModelSerializer):
    diagnosed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Diagnosis
        fields = [
            "id",
            "condition",
            "diagnosis_type",
            "notes",
            "diagnosed_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "diagnosed_by_name", "created_at"]

    def get_diagnosed_by_name(self, obj):
        name = f"{obj.diagnosed_by.first_name} {obj.diagnosed_by.last_name}".strip()
        return name or obj.diagnosed_by.email

    def validate(self, attrs):
        consultation = self.context["consultation"]
        if consultation.status != Consultation.Status.IN_PROGRESS:
            raise serializers.ValidationError(
                "Cannot add a diagnosis to a completed consultation."
            )
        diagnosis_type = attrs.get("diagnosis_type", Diagnosis.DiagnosisType.PRIMARY)
        if diagnosis_type == Diagnosis.DiagnosisType.PRIMARY and consultation.diagnoses.filter(
            diagnosis_type=Diagnosis.DiagnosisType.PRIMARY
        ).exists():
            raise serializers.ValidationError(
                "This consultation already has a primary diagnosis — add this as differential."
            )
        return attrs


class ConsultationSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    diagnoses = DiagnosisSerializer(many=True, read_only=True)

    class Meta:
        model = Consultation
        fields = [
            "id",
            "doctor",
            "doctor_name",
            "chief_complaint",
            "symptoms",
            "clinical_notes",
            "treatment_plan",
            "follow_up_instructions",
            "follow_up_date",
            "status",
            "completed_at",
            "diagnoses",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "doctor",
            "doctor_name",
            "status",
            "completed_at",
            "diagnoses",
            "created_at",
            "updated_at",
        ]

    def get_doctor_name(self, obj):
        name = f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return name or obj.doctor.email


class MedicalRecordSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = [
            "id",
            "visit_date",
            "chief_complaint",
            "diagnosis_summary",
            "treatment_plan",
            "doctor_name",
            "created_at",
        ]

    def get_doctor_name(self, obj):
        name = f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return name or obj.doctor.email
