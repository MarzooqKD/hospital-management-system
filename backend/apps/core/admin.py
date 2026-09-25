from django.contrib import admin

from .models import Department, Hospital


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "timezone", "is_active"]


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "hospital", "code", "is_active"]
    list_filter = ["hospital"]
