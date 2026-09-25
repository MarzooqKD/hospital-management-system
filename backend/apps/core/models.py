import uuid

from django.db import models


class TimestampedModel(models.Model):
    """created_at/updated_at on every table, per CLAUDE.md section 7."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """UUID PK for anything patient-facing, cross-module, or URL-exposed —
    see docs/ARCHITECTURE.md "Primary keys"."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimestampedModel):
    class Meta:
        abstract = True


class Hospital(BaseModel):
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    timezone = models.CharField(max_length=64, default="Africa/Accra")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Department(BaseModel):
    hospital = models.ForeignKey(
        Hospital, on_delete=models.PROTECT, related_name="departments"
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("hospital", "name")

    def __str__(self):
        return f"{self.name} ({self.hospital.name})"
