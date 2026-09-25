from django.urls import path

from .views import DiagnosisListCreateView

urlpatterns = [
    path("", DiagnosisListCreateView.as_view(), name="consultation-diagnoses"),
]
