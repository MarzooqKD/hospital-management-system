from django.contrib import admin

from .models import Allergy, Patient, PatientNumberSequence


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ["patient_number", "first_name", "last_name", "phone", "hospital", "is_active"]
    list_filter = ["hospital", "gender", "is_active"]
    search_fields = ["patient_number", "first_name", "last_name", "phone", "ghana_card_number"]


@admin.register(PatientNumberSequence)
class PatientNumberSequenceAdmin(admin.ModelAdmin):
    list_display = ["hospital", "last_number"]


@admin.register(Allergy)
class AllergyAdmin(admin.ModelAdmin):
    list_display = ["patient", "allergen", "severity", "is_active"]
    list_filter = ["severity", "is_active"]
    search_fields = ["allergen", "patient__first_name", "patient__last_name"]
