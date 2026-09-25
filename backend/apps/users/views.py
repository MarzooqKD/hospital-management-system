from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import HasModulePermission

from .models import User
from .serializers import UserSerializer


class MeView(RetrieveAPIView):
    """A user can always view their own profile — no module permission
    needed, just authentication."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserListView(ListAPIView):
    """Demonstrates the RBAC deny path: only roles granted users.view
    (System Admin, Hospital Admin per docs/RBAC.md) can list staff accounts."""

    queryset = User.objects.select_related("role", "hospital").order_by("email")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "users"
