from django.urls import path

from .views import ConsultationCompleteView, ConsultationDetailView, VitalSignListCreateView

urlpatterns = [
    path("vitals/", VitalSignListCreateView.as_view(), name="visit-vitals"),
    path("consultation/", ConsultationDetailView.as_view(), name="visit-consultation"),
    path(
        "consultation/complete/",
        ConsultationCompleteView.as_view(),
        name="visit-consultation-complete",
    ),
]
