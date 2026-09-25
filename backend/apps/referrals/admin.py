from django.contrib import admin

from .models import Referral


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ["patient", "referral_type", "destination", "status", "referred_by"]
    list_filter = ["hospital", "referral_type", "status"]
    search_fields = ["patient__first_name", "patient__last_name", "destination"]
