from django.db.models import Case, IntegerField, When
from rest_framework import mixins, status
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.audit.utils import log_action
from apps.core.permissions import HasModulePermission

from .models import Queue, Visit
from .serializers import CheckInSerializer, QueueSerializer, QueueUpdateSerializer, VisitSerializer


class VisitDetailView(RetrieveAPIView):
    """Header info (patient/department/status) for the clinical workspace
    at a given Visit — vitals/consultation/diagnosis/admissions/referrals
    all live under the same `/api/v1/visits/<id>/...` prefix. Every role
    that reaches this page holds queue.view (docs/RBAC.md), so this stays
    on the generic HasModulePermission mapping rather than a bespoke
    permission class."""

    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "queue"
    lookup_url_kwarg = "visit_id"

    def get_queryset(self):
        return Visit.objects.filter(hospital=self.request.user.hospital)


class QueueCheckInView(APIView):
    """Creates a Visit + Queue entry together — see
    CheckInSerializer.create(). A compound action, not plain CRUD, so this
    is a dedicated endpoint rather than QueueViewSet.create()."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "queue"

    def post(self, request):
        serializer = CheckInSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        queue_entry = serializer.save()
        log_action(
            actor=request.user,
            action="patient_checked_in",
            entity_type="visit",
            entity_id=queue_entry.visit_id,
            after=QueueSerializer(queue_entry, context={"request": request}).data,
            request=request,
        )
        return Response(
            QueueSerializer(queue_entry, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class QueueViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    """No create (see QueueCheckInView) and no destroy — a queue entry is
    moved to `cancelled` via PATCH, never removed (same append-only
    reasoning as Appointment cancellation)."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "queue"

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return QueueUpdateSerializer
        return QueueSerializer

    def get_queryset(self):
        qs = Queue.objects.filter(hospital=self.request.user.hospital).select_related(
            "visit", "visit__patient", "visit__department", "doctor"
        )
        params = self.request.query_params
        if department := params.get("department"):
            qs = qs.filter(visit__department_id=department)
        if status_param := params.get("status"):
            qs = qs.filter(status=status_param)
        else:
            qs = qs.exclude(status__in=[Queue.Status.COMPLETED, Queue.Status.CANCELLED])

        return qs.annotate(
            _priority_order=Case(
                When(priority=Queue.Priority.EMERGENCY, then=0),
                default=1,
                output_field=IntegerField(),
            )
        ).order_by("_priority_order", "queue_number")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)
        before_status = instance.status
        queue_entry = serializer.save()
        if queue_entry.status != before_status:
            log_action(
                actor=request.user,
                action="queue_status_changed",
                entity_type="visit",
                entity_id=queue_entry.visit_id,
                before={"status": before_status},
                after={"status": queue_entry.status},
                request=request,
            )
        return Response(QueueSerializer(queue_entry, context=self.get_serializer_context()).data)
