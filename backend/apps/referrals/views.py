from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.audit.utils import log_action
from apps.core.permissions import HasModulePermission
from apps.queues.models import Visit

from .models import Referral
from .serializers import ReferralSerializer, ReferralStatusSerializer


def _get_visit_or_404(request, visit_id):
    return get_object_or_404(Visit, pk=visit_id, hospital=request.user.hospital)


class VisitReferralListCreateView(mixins.ListModelMixin, mixins.CreateModelMixin, GenericAPIView):
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "referrals"

    def get_queryset(self):
        return Referral.objects.filter(visit=_get_visit_or_404(self.request, self.kwargs["visit_id"]))

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def perform_create(self, serializer):
        visit = _get_visit_or_404(self.request, self.kwargs["visit_id"])
        referral = serializer.save(
            hospital=visit.hospital,
            patient=visit.patient,
            visit=visit,
            referred_by=self.request.user,
        )
        log_action(
            actor=self.request.user,
            action="referral_created",
            entity_type="referral",
            entity_id=referral.id,
            after=ReferralSerializer(referral).data,
            request=self.request,
        )


class ReferralViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, GenericViewSet
):
    """Flat, hospital-wide worklist."""

    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "referrals"

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return ReferralStatusSerializer
        return ReferralSerializer

    def get_queryset(self):
        qs = Referral.objects.filter(hospital=self.request.user.hospital).select_related(
            "patient"
        )
        if status_param := self.request.query_params.get("status"):
            qs = qs.filter(status=status_param)
        return qs

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)
        before_status = instance.status
        referral = serializer.save()
        if referral.status != before_status:
            log_action(
                actor=request.user,
                action="referral_status_changed",
                entity_type="referral",
                entity_id=referral.id,
                before={"status": before_status},
                after={"status": referral.status},
                request=request,
            )
        return Response(ReferralSerializer(referral, context=self.get_serializer_context()).data)
