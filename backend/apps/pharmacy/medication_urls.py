from django.urls import path

from .views import MedicationListView

urlpatterns = [
    path("", MedicationListView.as_view(), name="medication-list"),
]
