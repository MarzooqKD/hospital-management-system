from rest_framework import serializers

from .models import Role, User


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "description"]


class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "hospital",
            "role",
            "is_active",
            "permissions",
        ]
        read_only_fields = fields

    def get_permissions(self, obj: User) -> dict[str, list[str]]:
        return obj.permitted_modules()
