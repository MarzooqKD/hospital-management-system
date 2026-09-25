from django.db import models

from apps.core.models import BaseModel


class Appointment(BaseModel):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        CONFIRMED = "confirmed", "Confirmed"
        CHECKED_IN = "checked_in", "Checked In"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"
        NO_SHOW = "no_show", "No-show"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="appointments"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="appointments"
    )
    department = models.ForeignKey(
        "core.Department", on_delete=models.PROTECT, related_name="appointments"
    )
    doctor = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="doctor_appointments",
        help_text="Optional — some bookings are department-only at booking time.",
    )
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=30)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="created_appointments",
    )

    class Meta:
        indexes = [
            models.Index(fields=["hospital", "scheduled_at"]),
            models.Index(fields=["doctor", "scheduled_at"]),
            models.Index(fields=["patient", "scheduled_at"]),
        ]
        ordering = ["scheduled_at"]

    def __str__(self):
        return f"{self.patient} — {self.scheduled_at:%Y-%m-%d %H:%M}"
