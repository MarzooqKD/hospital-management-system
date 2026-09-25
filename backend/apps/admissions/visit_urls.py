from django.urls import path

from .views import VisitAdmissionDetailView

urlpatterns = [
    path("", VisitAdmissionDetailView.as_view(), name="visit-admission"),
]
