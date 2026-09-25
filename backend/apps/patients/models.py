from django.db import models, transaction

from apps.core.models import BaseModel
from apps.core.validators import validate_ghana_card_number


class PatientNumberSequence(models.Model):
    """One row per hospital; the row lock under select_for_update serializes
    patient_number generation so concurrent registrations never collide."""

    hospital = models.OneToOneField(
        "core.Hospital", on_delete=models.CASCADE, related_name="patient_number_sequence"
    )
    last_number = models.PositiveIntegerField(default=0)


def generate_patient_number(hospital) -> str:
    with transaction.atomic():
        seq, _ = PatientNumberSequence.objects.select_for_update().get_or_create(
            hospital=hospital
        )
        seq.last_number += 1
        seq.save(update_fields=["last_number"])
        return f"PAT-{seq.last_number:06d}"


class Patient(BaseModel):
    class Gender(models.TextChoices):
        FEMALE = "female", "Female"
        MALE = "male", "Male"
        OTHER = "other", "Other"

    class BloodGroup(models.TextChoices):
        A_POS = "A+", "A+"
        A_NEG = "A-", "A-"
        B_POS = "B+", "B+"
        B_NEG = "B-", "B-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"
        O_POS = "O+", "O+"
        O_NEG = "O-", "O-"
        UNKNOWN = "unknown", "Unknown"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="patients"
    )
    patient_number = models.CharField(max_length=20)

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=Gender.choices)

    ghana_card_number = models.CharField(
        max_length=15, blank=True, validators=[validate_ghana_card_number]
    )
    nhis_number = models.CharField(max_length=30, blank=True)

    phone = models.CharField(max_length=20)
    alt_phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    address_region = models.CharField(max_length=100, blank=True)
    address_district = models.CharField(max_length=100, blank=True)
    address_town = models.CharField(max_length=100, blank=True)

    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_relationship = models.CharField(max_length=50, blank=True)

    blood_group = models.CharField(
        max_length=10, choices=BloodGroup.choices, default=BloodGroup.UNKNOWN
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["hospital", "patient_number"],
                name="unique_patient_number_per_hospital",
            ),
            models.UniqueConstraint(
                fields=["hospital", "ghana_card_number"],
                condition=models.Q(ghana_card_number__gt=""),
                name="unique_ghana_card_per_hospital",
            ),
        ]
        indexes = [
            models.Index(fields=["hospital", "last_name", "first_name"]),
            models.Index(fields=["hospital", "phone"]),
        ]

    def __str__(self):
        return f"{self.patient_number} — {self.first_name} {self.last_name}"


class Allergy(BaseModel):
    """Structured, not free-text, so pharmacy dispensing can safety-check
    against it later (docs/DATABASE.md — deferred from Phase 1 to Phase 2).
    Never hard-deleted: a wrongly-recorded allergy is deactivated
    (`is_active=False`), preserving the fact that it was once on record."""

    class Severity(models.TextChoices):
        MILD = "mild", "Mild"
        MODERATE = "moderate", "Moderate"
        SEVERE = "severe", "Severe"

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="allergies"
    )
    allergen = models.CharField(max_length=150)
    reaction = models.CharField(max_length=255, blank=True)
    severity = models.CharField(max_length=10, choices=Severity.choices)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="recorded_allergies"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "allergies"
        indexes = [models.Index(fields=["patient", "is_active"])]

    def __str__(self):
        return f"{self.allergen} ({self.get_severity_display()}) — {self.patient}"
