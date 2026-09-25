from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from apps.core.permissions import HasModulePermission

from .allergy_serializers import AllergySerializer
from .models import Allergy, Patient


def _get_patient_or_404(request, patient_id):
    """Hospital-scoped lookup — same IDOR-prevention pattern as
    apps.insurance.views._get_patient_or_404."""
    return get_object_or_404(Patient, pk=patient_id, hospital=request.user.hospital)


class AllergyListCreateView(mixins.ListModelMixin, mixins.CreateModelMixin, GenericAPIView):
    serializer_class = AllergySerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "patients"

    def get_queryset(self):
        patient = _get_patient_or_404(self.request, self.kwargs["patient_id"])
        return Allergy.objects.filter(patient=patient).order_by("-is_active", "-created_at")

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def perform_create(self, serializer):
        patient = _get_patient_or_404(self.request, self.kwargs["patient_id"])
        serializer.save(patient=patient, recorded_by=self.request.user)


class AllergyDetailView(mixins.UpdateModelMixin, GenericAPIView):
    """PATCH only — used to deactivate a wrongly-recorded allergy
    (`is_active=False`) rather than deleting it (docs/DATABASE.md)."""

    serializer_class = AllergySerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "patients"

    def get_queryset(self):
        patient = _get_patient_or_404(self.request, self.kwargs["patient_id"])
        return Allergy.objects.filter(patient=patient)

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)
