from django.contrib import admin

from .models import LaboratoryRequest, LaboratoryResult, LaboratoryTest


@admin.register(LaboratoryTest)
class LaboratoryTestAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["code", "name"]


@admin.register(LaboratoryRequest)
class LaboratoryRequestAdmin(admin.ModelAdmin):
    list_display = ["patient", "test", "status", "priority", "created_at"]
    list_filter = ["hospital", "status", "priority"]
    search_fields = ["patient__first_name", "patient__last_name", "patient__patient_number"]


@admin.register(LaboratoryResult)
class LaboratoryResultAdmin(admin.ModelAdmin):
    list_display = ["request", "is_abnormal", "performed_by", "validated_at"]

    def has_delete_permission(self, request, obj=None):
        return False
