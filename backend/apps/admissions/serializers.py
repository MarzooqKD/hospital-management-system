from rest_framework import serializers

from .models import Admission, Bed, Discharge, Room, Ward


class WardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ward
        fields = ["id", "name", "department", "is_active"]


class RoomSerializer(serializers.ModelSerializer):
    ward_name = serializers.CharField(source="ward.name", read_only=True)

    class Meta:
        model = Room
        fields = ["id", "ward", "ward_name", "name", "is_active"]


class BedSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)
    ward_name = serializers.CharField(source="room.ward.name", read_only=True)
    is_occupied = serializers.BooleanField(read_only=True)

    class Meta:
        model = Bed
        fields = ["id", "room", "room_name", "ward_name", "label", "is_occupied", "is_active"]


class DischargeSerializer(serializers.ModelSerializer):
    discharged_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Discharge
        fields = [
            "id",
            "summary",
            "follow_up_instructions",
            "discharged_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "discharged_by_name", "created_at"]

    def get_discharged_by_name(self, obj):
        name = f"{obj.discharged_by.first_name} {obj.discharged_by.last_name}".strip()
        return name or obj.discharged_by.email


class AdmissionSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    bed_label = serializers.SerializerMethodField()
    admitted_by_name = serializers.SerializerMethodField()
    discharge = DischargeSerializer(read_only=True)

    class Meta:
        model = Admission
        fields = [
            "id",
            "patient",
            "patient_name",
            "visit",
            "bed",
            "bed_label",
            "reason",
            "status",
            "admitted_by_name",
            "discharge",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "patient",
            "patient_name",
            "visit",
            "bed_label",
            "status",
            "admitted_by_name",
            "discharge",
            "created_at",
        ]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_bed_label(self, obj):
        return f"{obj.bed.room.ward.name} — {obj.bed.room.name} — Bed {obj.bed.label}"

    def get_admitted_by_name(self, obj):
        name = f"{obj.admitted_by.first_name} {obj.admitted_by.last_name}".strip()
        return name or obj.admitted_by.email

    def validate_bed(self, value):
        request = self.context["request"]
        if value.room.ward.hospital_id != request.user.hospital_id:
            raise serializers.ValidationError("Bed does not belong to your hospital.")
        if value.is_occupied:
            raise serializers.ValidationError("This bed already has an active admission.")
        return value


class TransferSerializer(serializers.Serializer):
    bed = serializers.PrimaryKeyRelatedField(queryset=Bed.objects.all())

    def validate_bed(self, value):
        admission = self.context["admission"]
        request = self.context["request"]
        if value.room.ward.hospital_id != request.user.hospital_id:
            raise serializers.ValidationError("Bed does not belong to your hospital.")
        if value.pk == admission.bed_id:
            raise serializers.ValidationError("Patient is already in this bed.")
        if value.is_occupied:
            raise serializers.ValidationError("This bed already has an active admission.")
        return value
