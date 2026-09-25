from rest_framework import serializers

from .models import Allergy


class AllergySerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Allergy
        fields = [
            "id",
            "allergen",
            "reaction",
            "severity",
            "notes",
            "recorded_by_name",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "recorded_by_name", "created_at"]

    def get_recorded_by_name(self, obj):
        return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip() or obj.recorded_by.email
