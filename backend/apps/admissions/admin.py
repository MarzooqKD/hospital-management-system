from django.contrib import admin

from .models import Admission, Bed, Discharge, Room, Ward


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ["name", "hospital", "department", "is_active"]
    list_filter = ["hospital", "is_active"]


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ["name", "ward", "is_active"]
    list_filter = ["ward", "is_active"]


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ["label", "room", "is_active"]
    list_filter = ["room__ward", "is_active"]


@admin.register(Admission)
class AdmissionAdmin(admin.ModelAdmin):
    list_display = ["patient", "bed", "status", "admitted_by", "created_at"]
    list_filter = ["hospital", "status"]
    search_fields = ["patient__first_name", "patient__last_name", "patient__patient_number"]


@admin.register(Discharge)
class DischargeAdmin(admin.ModelAdmin):
    list_display = ["admission", "discharged_by", "created_at"]

    def has_delete_permission(self, request, obj=None):
        return False
