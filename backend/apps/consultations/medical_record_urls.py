from django.urls import path

from .views import MedicalRecordListView

urlpatterns = [
    path("", MedicalRecordListView.as_view(), name="patient-medical-records"),
]
