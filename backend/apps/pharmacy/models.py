from django.db import models

from apps.core.models import BaseModel


class Medication(BaseModel):
    """The clinical catalogue — what a doctor prescribes. Deliberately
    separate from `inventory.InventoryItem` (generic stock tracking shared
    with non-medication supplies), linked by FK — docs/DATABASE.md."""

    class Form(models.TextChoices):
        TABLET = "tablet", "Tablet"
        CAPSULE = "capsule", "Capsule"
        SYRUP = "syrup", "Syrup"
        INJECTION = "injection", "Injection"
        CREAM = "cream", "Cream"
        OINTMENT = "ointment", "Ointment"
        DROPS = "drops", "Drops"
        OTHER = "other", "Other"

    name = models.CharField(max_length=150)
    generic_name = models.CharField(max_length=150, blank=True)
    form = models.CharField(max_length=15, choices=Form.choices, default=Form.TABLET)
    strength = models.CharField(max_length=50, blank=True, help_text='e.g. "500mg"')
    unit = models.CharField(max_length=30, default="tablet", help_text='e.g. "tablet", "ml"')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]

    def __str__(self):
        return f"{self.name} {self.strength}".strip()


class Prescription(BaseModel):
    """One per Consultation (OneToOne) — mirrors Consultation's other
    per-visit outputs (Diagnosis, and now this). A follow-up visit's
    prescription belongs to that visit's own new Consultation."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIALLY_DISPENSED = "partially_dispensed", "Partially Dispensed"
        DISPENSED = "dispensed", "Dispensed"
        CANCELLED = "cancelled", "Cancelled"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="prescriptions"
    )
    consultation = models.OneToOneField(
        "consultations.Consultation", on_delete=models.PROTECT, related_name="prescription"
    )
    doctor = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="prescriptions_issued"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Prescription — {self.consultation.visit.patient} ({self.status})"


class PrescriptionItem(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        DISPENSED = "dispensed", "Dispensed"
        CANCELLED = "cancelled", "Cancelled"

    prescription = models.ForeignKey(
        Prescription, on_delete=models.PROTECT, related_name="items"
    )
    medication = models.ForeignKey(
        Medication, on_delete=models.PROTECT, related_name="prescription_items"
    )
    dosage = models.CharField(max_length=100, help_text='e.g. "1 tablet"')
    frequency = models.CharField(max_length=100, help_text='e.g. "twice daily"')
    duration_days = models.PositiveIntegerField()
    instructions = models.TextField(blank=True, help_text='e.g. "after meals"')
    quantity_prescribed = models.PositiveIntegerField()
    quantity_dispensed = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    dispensed_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="items_dispensed",
    )
    dispensed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.medication} x{self.quantity_prescribed} ({self.status})"
