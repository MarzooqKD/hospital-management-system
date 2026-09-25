from django.db import models

from apps.core.models import BaseModel


class Referral(BaseModel):
    class ReferralType(models.TextChoices):
        INTERNAL = "internal", "Internal"
        EXTERNAL = "external", "External"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="referrals"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="referrals"
    )
    visit = models.ForeignKey(
        "queues.Visit", on_delete=models.PROTECT, related_name="referrals"
    )
    referral_type = models.CharField(max_length=10, choices=ReferralType.choices)
    destination = models.CharField(
        max_length=255,
        help_text="Department name if internal, facility/specialist name if external.",
    )
    reason = models.TextField()
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    referred_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="referrals_made"
    )

    class Meta:
        indexes = [models.Index(fields=["hospital", "status"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Referral — {self.patient} to {self.destination} ({self.status})"
