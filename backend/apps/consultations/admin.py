from django.contrib import admin

from .models import Consultation, Diagnosis, MedicalRecord, VitalSign


@admin.register(VitalSign)
class VitalSignAdmin(admin.ModelAdmin):
    list_display = ["visit", "bmi", "recorded_by", "created_at"]
    list_filter = ["hospital"]


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ["visit", "doctor", "status", "completed_at"]
    list_filter = ["hospital", "status"]

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Diagnosis)
class DiagnosisAdmin(admin.ModelAdmin):
    list_display = ["condition", "diagnosis_type", "consultation", "diagnosed_by"]
    list_filter = ["diagnosis_type"]


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ["patient", "visit_date", "doctor"]
    list_filter = ["hospital"]
    search_fields = ["patient__first_name", "patient__last_name", "patient__patient_number"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
