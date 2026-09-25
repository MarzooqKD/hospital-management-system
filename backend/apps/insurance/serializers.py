from rest_framework import serializers

from .models import Insurance


class InsuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insurance
        fields = [
            "id",
            "provider_type",
            "provider_name",
            "policy_number",
            "member_id",
            "is_active",
            "valid_from",
            "valid_to",
        ]
