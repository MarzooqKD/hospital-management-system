from django.contrib import admin

from .models import Queue, QueueNumberSequence, Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ["patient", "department", "hospital", "status", "created_at"]
    list_filter = ["hospital", "department", "status"]
    search_fields = ["patient__first_name", "patient__last_name", "patient__patient_number"]


@admin.register(Queue)
class QueueAdmin(admin.ModelAdmin):
    list_display = ["queue_number", "visit", "doctor", "priority", "status"]
    list_filter = ["hospital", "priority", "status"]


@admin.register(QueueNumberSequence)
class QueueNumberSequenceAdmin(admin.ModelAdmin):
    list_display = ["hospital", "department", "date", "last_number"]
