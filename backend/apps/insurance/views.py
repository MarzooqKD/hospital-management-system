from django.shortcuts import get_object_or_404
from rest_framework import mixins, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasModulePermission
from apps.patients.models import Patient

from .models import Insurance
from .providers import get_provider
from .serializers import InsuranceSerializer


def _get_patient_or_404(request, patient_id):
    """Hospital-scoped lookup — prevents an authenticated user from one
    hospital reading/writing insurance records for a patient in another by
    guessing a UUID (IDOR, CLAUDE.md section 12)."""
    return get_object_or_404(Patient, pk=patient_id, hospital=request.user.hospital)


class InsuranceListCreateView(mixins.ListModelMixin, mixins.CreateModelMixin, GenericAPIView):
    serializer_class = InsuranceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "patients"

    def get_queryset(self):
        patient = _get_patient_or_404(self.request, self.kwargs["patient_id"])
        return Insurance.objects.filter(patient=patient).order_by("-created_at")

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def perform_create(self, serializer):
        patient = _get_patient_or_404(self.request, self.kwargs["patient_id"])
        serializer.save(patient=patient)


class InsuranceVerifyView(APIView):
    """GET, not POST — this is a read-only check against the mock provider,
    nothing is persisted. Demonstrates the integration seam end-to-end
    (CLAUDE.md section 4) without needing its own RBAC module."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "patients"

    def get(self, request, patient_id, pk):
        patient = _get_patient_or_404(request, patient_id)
        insurance = get_object_or_404(Insurance, pk=pk, patient=patient)

        try:
            provider = get_provider(insurance.provider_type)
        except NotImplementedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        result = provider.check_eligibility(insurance.member_id or insurance.policy_number)
        return Response(
            {
                "eligible": result.eligible,
                "provider_reference": result.provider_reference,
                "message": result.message,
            }
        )
