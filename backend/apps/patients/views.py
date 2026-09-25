from rest_framework import filters, mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.audit.utils import log_action
from apps.core.permissions import HasModulePermission

from .models import Patient, generate_patient_number
from .serializers import PatientDetailSerializer, PatientListSerializer


class PatientViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    """No destroy action — Patient Records grants no role a delete
    permission (docs/RBAC.md); deletion is a PATCH of `is_active`, which
    the edit permission already covers. A deleted patient is still
    reachable by id (retrieve/update) so the detail page can show them and
    restore access — only the default `list` excludes them, the same
    reference-data-deactivation pattern already used for Ward/Room/Bed."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "patients"
    filter_backends = [filters.SearchFilter]
    search_fields = ["first_name", "last_name", "patient_number", "phone", "ghana_card_number"]

    def get_serializer_class(self):
        if self.action == "list":
            return PatientListSerializer
        return PatientDetailSerializer

    def get_queryset(self):
        hospital = self.request.user.hospital
        qs = Patient.objects.filter(hospital=hospital)
        if self.action == "list" and self.request.query_params.get("include_deleted") != "true":
            qs = qs.filter(is_active=True)
        return qs.order_by("last_name", "first_name")

    def perform_create(self, serializer):
        hospital = self.request.user.hospital
        patient = serializer.save(
            hospital=hospital, patient_number=generate_patient_number(hospital)
        )
        log_action(
            actor=self.request.user,
            action="patient_created",
            entity_type="patient",
            entity_id=patient.id,
            after=PatientDetailSerializer(patient, context=self.get_serializer_context()).data,
            request=self.request,
        )

    def perform_update(self, serializer):
        before = PatientDetailSerializer(
            serializer.instance, context=self.get_serializer_context()
        ).data
        patient = serializer.save()
        log_action(
            actor=self.request.user,
            action="patient_updated",
            entity_type="patient",
            entity_id=patient.id,
            before=before,
            after=PatientDetailSerializer(patient, context=self.get_serializer_context()).data,
            request=self.request,
        )
