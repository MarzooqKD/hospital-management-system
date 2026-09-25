from django.urls import path

from .views import InsuranceListCreateView, InsuranceVerifyView

urlpatterns = [
    path("", InsuranceListCreateView.as_view(), name="patient-insurance-list"),
    path("<uuid:pk>/verify/", InsuranceVerifyView.as_view(), name="patient-insurance-verify"),
]
