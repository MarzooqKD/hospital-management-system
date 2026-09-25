from decimal import Decimal

from django.db import models

from apps.core.models import BaseModel


class VitalSign(BaseModel):
    """FK to Visit, not OneToOne — a visit can be re-checked (e.g. after
    treatment), so more than one reading per visit is expected."""

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="vital_signs"
    )
    visit = models.ForeignKey(
        "queues.Visit", on_delete=models.PROTECT, related_name="vital_signs"
    )
    temperature_celsius = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    blood_pressure_systolic = models.PositiveSmallIntegerField(null=True, blank=True)
    blood_pressure_diastolic = models.PositiveSmallIntegerField(null=True, blank=True)
    pulse_bpm = models.PositiveSmallIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    spo2_percent = models.PositiveSmallIntegerField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    bmi = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, editable=False)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="recorded_vital_signs"
    )

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.weight_kg and self.height_cm:
            height_m = self.height_cm / Decimal("100")
            self.bmi = (self.weight_kg / (height_m * height_m)).quantize(Decimal("0.1"))
        else:
            self.bmi = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Vitals — {self.visit.patient} ({self.created_at:%Y-%m-%d %H:%M})"


class Consultation(BaseModel):
    """One per Visit for Phase 2 (OneToOne) — a walk-in re-visit gets its
    own new Visit, not a second Consultation on the same one. Immutable
    once `status=completed` (enforced in the view, not here): a doctor
    can't silently rewrite a finalized clinical note."""

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="consultations"
    )
    visit = models.OneToOneField(
        "queues.Visit", on_delete=models.PROTECT, related_name="consultation"
    )
    doctor = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="consultations"
    )
    chief_complaint = models.TextField(blank=True)
    symptoms = models.TextField(blank=True)
    clinical_notes = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    follow_up_instructions = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.IN_PROGRESS)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Consultation — {self.visit.patient} ({self.status})"


class Diagnosis(BaseModel):
    class DiagnosisType(models.TextChoices):
        PRIMARY = "primary", "Primary"
        DIFFERENTIAL = "differential", "Differential"

    consultation = models.ForeignKey(
        Consultation, on_delete=models.PROTECT, related_name="diagnoses"
    )
    condition = models.CharField(max_length=255)
    diagnosis_type = models.CharField(
        max_length=15, choices=DiagnosisType.choices, default=DiagnosisType.PRIMARY
    )
    notes = models.TextField(blank=True)
    diagnosed_by = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="diagnoses"
    )

    class Meta:
        ordering = ["-diagnosis_type", "created_at"]
        verbose_name_plural = "diagnoses"

    def __str__(self):
        return f"{self.condition} ({self.get_diagnosis_type_display()})"


class MedicalRecord(BaseModel):
    """Append-only historical snapshot, auto-created when a Consultation is
    marked completed (see consultations.views.ConsultationCompleteView) —
    never created or edited directly through the API. This is a deliberate
    resolution of an open question (CLAUDE.md section 7 lists MedicalRecord
    as a required entity but doesn't define it): rather than a second,
    independently-editable clinical table that could drift from
    Consultation/Diagnosis, it's the immutable trace of what a finished
    visit concluded — the stable row Reports (Phase 5) and "medical
    history" views query, without re-deriving from mutable working data.
    No delete/update path exists, same as AuditLog/InventoryTransaction
    (docs/ARCHITECTURE.md "Deletion policy")."""

    hospital = models.ForeignKey(
        "core.Hospital", on_delete=models.PROTECT, related_name="medical_records"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.PROTECT, related_name="medical_records"
    )
    visit = models.OneToOneField(
        "queues.Visit", on_delete=models.PROTECT, related_name="medical_record"
    )
    visit_date = models.DateField()
    chief_complaint = models.TextField(blank=True)
    diagnosis_summary = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    doctor = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="authored_medical_records"
    )

    class Meta:
        ordering = ["-visit_date"]

    def __str__(self):
        return f"Medical record — {self.patient} ({self.visit_date})"
