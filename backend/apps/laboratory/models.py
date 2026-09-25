from django.db import models

from apps.core.models import BaseModel, TimestampedModel


class LaboratoryTest(TimestampedModel):
    """Catalogue entry. Auto-increment PK — a pure internal lookup table,
    never referenced as an external resource id
    (docs/ARCHITECTURE.md "Primary keys")."""

    class Category(models.TextChoices):
        HEMATOLOGY = "hematology", "Hematology"
        BIOCHEMISTRY = "biochemistry", "Biochemistry"
        MICROBIOLOGY = "microbiology", "Microbiology"
        PARASITOLOGY = "parasitology", "Parasitology"
        SEROLOGY = "serology", "Serology"
        OTHER = "other", "Other"

    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    sample_type = models.CharField(max_length=100, blank=True)
    normal_range_text = models.CharField(
        max_length=255,
        blank=True,
        help_text="Free text — reference ranges vary too widely by test/units to structure.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class LaboratoryRequest(BaseModel):
    """One test per request row (not a bundle) — a doctor ordering two
    tests creates two requests. Keeps the model normalized without adding a
    LaboratoryRequestItem join table beyond CLAUDE.md §7's minimum list."""

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        SAMPLE_COLLECTED = "sample_collected", "Sample Collected"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class Priority(models.TextChoices):
        NORMAL = "normal", "Normal"
        URGENT = "urgent", "Urgent"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="lab_requests"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="lab_requests"
    )
    consultation = models.ForeignKey(
        "consultations.Consultation", on_delete=models.PROTECT, related_name="lab_requests"
    )
    test = models.ForeignKey(LaboratoryTest, on_delete=models.PROTECT, related_name="requests")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    notes = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="lab_requests_made"
    )
    sample_collected_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["hospital", "status"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.test.code} — {self.patient} ({self.status})"


class LaboratoryResult(BaseModel):
    """One per request. Recorded by a Lab Technician, then validated by a
    second action (docs/RBAC.md — CLAUDE.md §6 calls out "result
    validation" as its own step). Only a validated result is treated as
    the request's final, doctor/patient-visible outcome — see
    apps.laboratory.serializers for the visibility gate."""

    request = models.OneToOneField(
        LaboratoryRequest, on_delete=models.PROTECT, related_name="result"
    )
    result_value = models.TextField()
    is_abnormal = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="lab_results_performed"
    )
    validated_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lab_results_validated",
    )
    validated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Result — {self.request}"
