from django.contrib import admin

from .models import Insurance


@admin.register(Insurance)
class InsuranceAdmin(admin.ModelAdmin):
    list_display = ["patient", "provider_type", "provider_name", "policy_number", "is_active"]
    list_filter = ["provider_type", "is_active"]
