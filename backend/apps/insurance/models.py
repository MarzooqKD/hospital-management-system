from django.db import models

from apps.core.models import BaseModel


class Insurance(BaseModel):
    """Generic enough to represent NHIS and private insurers
    (CLAUDE.md section 4). One patient can hold more than one — e.g. NHIS
    plus a private top-up — so this is a plain FK, not one-to-one."""

    class ProviderType(models.TextChoices):
        NHIS = "nhis", "NHIS"
        PRIVATE = "private", "Private insurer"

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="insurance_records"
    )
    provider_type = models.CharField(max_length=10, choices=ProviderType.choices)
    provider_name = models.CharField(max_length=150)
    policy_number = models.CharField(max_length=100, blank=True)
    member_id = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.get_provider_type_display()} — {self.patient}"
