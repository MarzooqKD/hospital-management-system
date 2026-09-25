from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.audit.utils import log_action
from apps.core.permissions import HasModulePermission

from .models import InventoryItem, InventoryTransaction, Supplier
from .serializers import (
    InventoryItemSerializer,
    InventoryTransactionSerializer,
    RecordTransactionSerializer,
    SupplierSerializer,
)


class SupplierListCreateView(ListCreateAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "inventory"

    def get_queryset(self):
        return Supplier.objects.filter(is_active=True)


class InventoryItemViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    """No destroy — deactivate via `PATCH is_active`. `POST` (create a new
    catalogue entry) is the standard RBAC `create` action, restricted to
    Hospital Admin by the matrix (docs/RBAC.md); recording a stock
    movement against an existing item is a separate endpoint below with a
    deliberately different permission check — see
    InventoryTransactionListCreateView."""

    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    required_module = "inventory"

    def get_queryset(self):
        qs = InventoryItem.objects.filter(hospital=self.request.user.hospital).select_related(
            "medication", "supplier"
        )
        params = self.request.query_params
        if category := params.get("category"):
            qs = qs.filter(category=category)
        if params.get("low_stock") == "true":
            qs = qs.filter(quantity_on_hand__lte=F("reorder_level"))
        return qs

    def perform_create(self, serializer):
        serializer.save(hospital=self.request.user.hospital)


def _get_item_or_404(request, item_id):
    return get_object_or_404(InventoryItem, pk=item_id, hospital=request.user.hospital)


class InventoryTransactionListCreateView(APIView):
    """Deliberately NOT gated by the generic HasModulePermission's
    POST→create mapping: docs/RBAC.md grants Lab Technician/Pharmacist
    `inventory.edit` but not `inventory.create` (only Hospital Admin can
    create a brand-new catalogue entry) — yet they're the ones who record
    day-to-day stock movements. Recording a transaction is conceptually an
    edit of the item's stock level, so this checks `edit` explicitly
    rather than relying on the shared class's method→action mapping."""

    permission_classes = [IsAuthenticated]

    def get(self, request, item_id):
        if not request.user.has_module_permission("inventory", "view"):
            raise PermissionDenied("You do not have inventory.view.")
        item = _get_item_or_404(request, item_id)
        transactions = item.transactions.select_related("performed_by")[:100]
        return Response(InventoryTransactionSerializer(transactions, many=True).data)

    def post(self, request, item_id):
        if not request.user.has_module_permission("inventory", "edit"):
            raise PermissionDenied("You do not have inventory.edit.")
        item = _get_item_or_404(request, item_id)
        serializer = RecordTransactionSerializer(data=request.data, context={"item": item})
        serializer.is_valid(raise_exception=True)
        signed_quantity = serializer.validated_data.pop("signed_quantity")

        with transaction.atomic():
            locked_item = InventoryItem.objects.select_for_update().get(pk=item.pk)
            if locked_item.quantity_on_hand + signed_quantity < 0:
                return Response(
                    {"detail": "This would take quantity on hand below zero."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            txn = InventoryTransaction.objects.create(
                hospital=locked_item.hospital,
                item=locked_item,
                transaction_type=serializer.validated_data["transaction_type"],
                quantity_change=signed_quantity,
                batch_number=serializer.validated_data.get("batch_number", ""),
                expiry_date=serializer.validated_data.get("expiry_date"),
                notes=serializer.validated_data.get("notes", ""),
                performed_by=request.user,
            )
            locked_item.quantity_on_hand += signed_quantity
            locked_item.save(update_fields=["quantity_on_hand", "updated_at"])

        log_action(
            actor=request.user,
            action="inventory_transaction_recorded",
            entity_type="inventory_item",
            entity_id=item.id,
            after=InventoryTransactionSerializer(txn).data,
            request=request,
        )
        return Response(InventoryTransactionSerializer(txn).data, status=status.HTTP_201_CREATED)
