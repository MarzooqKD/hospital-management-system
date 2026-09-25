from django.db import models

from apps.core.models import BaseModel, TimestampedModel


class Ward(TimestampedModel):
    """Auto-increment PK — internal lookup table, never referenced as an
    external resource id (docs/ARCHITECTURE.md "Primary keys" already names
    Ward/Room/Bed in the auto-increment exception list)."""

    hospital = models.ForeignKey("core.Hospital", on_delete=models.PROTECT, related_name="wards")
    department = models.ForeignKey(
        "core.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="wards",
    )
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("hospital", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.hospital.name})"


class Room(TimestampedModel):
    ward = models.ForeignKey(Ward, on_delete=models.PROTECT, related_name="rooms")
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("ward", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.ward.name} — Room {self.name}"


class Bed(TimestampedModel):
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="beds")
    label = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("room", "label")
        ordering = ["label"]

    def __str__(self):
        return f"{self.room} — Bed {self.label}"

    @property
    def is_occupied(self) -> bool:
        return self.admissions.filter(status=Admission.Status.ADMITTED).exists()


class Admission(BaseModel):
    """One admission per Visit (OneToOne) — a readmission is a fresh
    check-in and a fresh Visit, not a second Admission on the same one.
    `unique_active_admission_per_bed` is the double-booking guard named as
    a known requirement back in docs/DATABASE.md before this app existed."""

    class Status(models.TextChoices):
        ADMITTED = "admitted", "Admitted"
        DISCHARGED = "discharged", "Discharged"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="admissions"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="admissions"
    )
    visit = models.OneToOneField(
        "queues.Visit", on_delete=models.PROTECT, related_name="admission"
    )
    bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name="admissions")
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ADMITTED)
    admitted_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="admissions_made"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["bed"],
                condition=models.Q(status="admitted"),
                name="unique_active_admission_per_bed",
            )
        ]
        indexes = [models.Index(fields=["hospital", "status"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.patient} — {self.bed} ({self.status})"


class Discharge(BaseModel):
    admission = models.OneToOneField(
        Admission, on_delete=models.PROTECT, related_name="discharge"
    )
    summary = models.TextField(blank=True)
    follow_up_instructions = models.TextField(blank=True)
    discharged_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="discharges_made"
    )

    def __str__(self):
        return f"Discharge — {self.admission.patient}"
