from django.db import models, transaction
from django.utils import timezone

from apps.core.models import BaseModel


class Visit(BaseModel):
    """The actual encounter — deliberately separate from Appointment
    (docs/DATABASE.md "Appointment vs. Visit"). A walk-in with no prior
    booking still gets a Visit; everything clinical (VitalSign,
    Consultation, Diagnosis, MedicalRecord) hangs off this, not Appointment."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Closed"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="visits"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="visits"
    )
    department = models.ForeignKey(
        "core.Department", on_delete=models.PROTECT, related_name="visits"
    )
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="visits",
        help_text="Null for a walk-in with no prior booking.",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="checked_in_visits"
    )

    class Meta:
        indexes = [models.Index(fields=["hospital", "patient", "status"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Visit — {self.patient} ({self.created_at:%Y-%m-%d})"


class QueueNumberSequence(models.Model):
    """One row per (hospital, department, date) — mirrors
    patients.PatientNumberSequence's select_for_update pattern, with a date
    dimension since queue numbers reset daily (real clinic behaviour: "you
    are number 12 today", not a number that climbs forever)."""

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE)
    department = models.ForeignKey("core.Department", on_delete=models.CASCADE)
    date = models.DateField()
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("hospital", "department", "date")


def generate_queue_number(hospital, department) -> int:
    today = timezone.localdate()
    with transaction.atomic():
        seq, _ = QueueNumberSequence.objects.select_for_update().get_or_create(
            hospital=hospital, department=department, date=today
        )
        seq.last_number += 1
        seq.save(update_fields=["last_number"])
        return seq.last_number


class Queue(BaseModel):
    """One check-in workflow entry per Visit (1:1 — a visit is checked in
    once). Status/priority per CLAUDE.md section 6 "Queue Management"."""

    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting"
        IN_CONSULTATION = "in_consultation", "In Consultation"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class Priority(models.TextChoices):
        NORMAL = "normal", "Normal"
        EMERGENCY = "emergency", "Emergency"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="queue_entries"
    )
    visit = models.OneToOneField(Visit, on_delete=models.PROTECT, related_name="queue_entry")
    doctor = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="queue_entries",
        help_text="Assigned at check-in from the linked appointment, or when called.",
    )
    queue_number = models.PositiveIntegerField()
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    called_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["hospital", "status"])]
        ordering = ["queue_number"]

    def __str__(self):
        return f"#{self.queue_number} — {self.visit.patient} ({self.status})"
