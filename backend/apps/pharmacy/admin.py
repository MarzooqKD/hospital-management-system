from django.contrib import admin

from .models import Medication, Prescription, PrescriptionItem


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = ["name", "strength", "form", "is_active"]
    search_fields = ["name", "generic_name"]


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 0


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ["consultation", "doctor", "status", "created_at"]
    list_filter = ["hospital", "status"]
    inlines = [PrescriptionItemInline]
