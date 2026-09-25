from rest_framework import serializers

from .models import InventoryItem, InventoryTransaction, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "phone", "email", "address", "is_active"]


class InventoryItemSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source="medication.name", read_only=True, default=None)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "medication",
            "medication_name",
            "name",
            "category",
            "unit",
            "quantity_on_hand",
            "reorder_level",
            "supplier",
            "supplier_name",
            "is_low_stock",
            "is_active",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "quantity_on_hand",
            "medication_name",
            "supplier_name",
            "is_low_stock",
            "created_at",
        ]

    def validate_medication(self, value):
        if value is None:
            return value
        request = self.context["request"]
        existing = InventoryItem.objects.filter(hospital=request.user.hospital, medication=value)
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError(
                "An inventory item for this medication already exists at this hospital."
            )
        return value


class InventoryTransactionSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = InventoryTransaction
        fields = [
            "id",
            "transaction_type",
            "quantity_change",
            "batch_number",
            "expiry_date",
            "notes",
            "performed_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_performed_by_name(self, obj):
        name = f"{obj.performed_by.first_name} {obj.performed_by.last_name}".strip()
        return name or obj.performed_by.email


class RecordTransactionSerializer(serializers.Serializer):
    """Input for recording a stock movement. Not a ModelSerializer — the
    write touches two rows (a new InventoryTransaction plus an update to
    InventoryItem.quantity_on_hand) inside one locked transaction, done in
    the view (mirrors CheckInSerializer/ConsultationCompleteView)."""

    transaction_type = serializers.ChoiceField(choices=InventoryTransaction.TransactionType.choices)
    quantity = serializers.IntegerField()
    batch_number = serializers.CharField(required=False, allow_blank=True, default="")
    expiry_date = serializers.DateField(required=False, allow_null=True, default=None)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        item = self.context["item"]
        t_type = attrs["transaction_type"]
        quantity = attrs["quantity"]

        if t_type in (
            InventoryTransaction.TransactionType.RECEIVED,
            InventoryTransaction.TransactionType.ISSUED,
        ):
            if quantity <= 0:
                raise serializers.ValidationError(
                    {"quantity": "Must be a positive number for received/issued."}
                )
            signed_quantity = (
                quantity
                if t_type == InventoryTransaction.TransactionType.RECEIVED
                else -quantity
            )
        else:
            if quantity == 0:
                raise serializers.ValidationError(
                    {"quantity": "An adjustment quantity cannot be zero."}
                )
            signed_quantity = quantity

        if item.quantity_on_hand + signed_quantity < 0:
            raise serializers.ValidationError(
                "This would take quantity on hand below zero."
            )
        attrs["signed_quantity"] = signed_quantity
        return attrs
