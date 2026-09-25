from django.urls import path

from .allergy_views import AllergyDetailView, AllergyListCreateView

urlpatterns = [
    path("", AllergyListCreateView.as_view(), name="patient-allergy-list"),
    path("<uuid:pk>/", AllergyDetailView.as_view(), name="patient-allergy-detail"),
]
