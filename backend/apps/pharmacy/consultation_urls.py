from django.urls import path

from .views import ConsultationPrescriptionDetailView

urlpatterns = [
    path("", ConsultationPrescriptionDetailView.as_view(), name="consultation-prescription"),
]
