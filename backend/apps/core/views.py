from django.db import Error as DjangoDatabaseError
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Department
from .serializers import DepartmentSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Reports API liveness and database connectivity for Phase 0 verification."""
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DjangoDatabaseError:
        db_ok = False

    return Response(
        {
            "status": "ok" if db_ok else "degraded",
            "database": "connected" if db_ok else "unreachable",
        },
        status=200 if db_ok else 503,
    )


class DepartmentListView(ListAPIView):
    """Reference data every staff member needs (e.g. to book an
    appointment) — no dedicated RBAC module, just authentication."""

    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Department.objects.filter(
            hospital=self.request.user.hospital, is_active=True
        ).order_by("name")
