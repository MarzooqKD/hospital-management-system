from django.db import models

from apps.core.models import BaseModel, TimestampedModel


class Supplier(TimestampedModel):
    """Auto-increment PK — internal lookup table, never referenced as an
    external resource id (docs/ARCHITECTURE.md "Primary keys")."""

    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class InventoryItem(BaseModel):
    """Generic stock tracking, shared with non-medication supplies —
    deliberately separate from the clinical `pharmacy.Medication`
    catalogue (docs/DATABASE.md). `quantity_on_hand` is a maintained
    running total, never written directly by the API — only
    `InventoryTransaction` creation updates it, so the ledger and the
    total can never drift apart."""

    class Category(models.TextChoices):
        MEDICATION = "medication", "Medication"
        CONSUMABLE = "consumable", "Consumable"
        EQUIPMENT = "equipment", "Equipment"
        OTHER = "other", "Other"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="inventory_items"
    )
    medication = models.ForeignKey(
        "pharmacy.Medication",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inventory_items",
        help_text="Set only for category=medication — links stock to the clinical catalogue.",
    )
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=15, choices=Category.choices, default=Category.OTHER)
    unit = models.CharField(max_length=30, help_text='e.g. "tablet", "box", "vial"')
    quantity_on_hand = models.IntegerField(default=0)
    reorder_level = models.PositiveIntegerField(
        default=0, help_text="quantity_on_hand at or below this triggers a low-stock flag."
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inventory_items",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "medication"],
                condition=models.Q(medication__isnull=False),
                name="unique_inventory_item_per_medication_per_hospital",
            )
        ]
        indexes = [models.Index(fields=["hospital", "category"])]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.quantity_on_hand} {self.unit})"

    @property
    def is_low_stock(self) -> bool:
        return self.quantity_on_hand <= self.reorder_level


class InventoryTransaction(TimestampedModel):
    """Append-only ledger — auto-increment PK and no delete path, same
    treatment as AuditLog (docs/ARCHITECTURE.md "Deletion policy" already
    names these two together). Batch/expiry are tracked per-transaction
    rather than on InventoryItem: a proper FEFO-aware StockBatch entity
    would be the "correct" model but isn't in CLAUDE.md §7's minimum list —
    this is a known simplification, revisit if it becomes a real pain
    point (docs/DATABASE.md)."""

    class TransactionType(models.TextChoices):
        RECEIVED = "received", "Received"
        ISSUED = "issued", "Issued"
        ADJUSTED = "adjusted", "Adjusted"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="inventory_transactions"
    )
    item = models.ForeignKey(
        InventoryItem, on_delete=models.PROTECT, related_name="transactions"
    )
    transaction_type = models.CharField(max_length=10, choices=TransactionType.choices)
    quantity_change = models.IntegerField(
        help_text="Positive for received/upward adjustment, negative for issued/downward."
    )
    batch_number = models.CharField(max_length=100, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    dispensed_prescription_item = models.ForeignKey(
        "pharmacy.PrescriptionItem",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inventory_transactions",
        help_text="Set when this ISSUED transaction was caused by dispensing a prescription.",
    )
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="inventory_transactions"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["item", "created_at"])]

    def __str__(self):
        return f"{self.transaction_type} {self.quantity_change} — {self.item}"
