from django.urls import path

from .views import ConsultationLabRequestListCreateView

urlpatterns = [
    path("", ConsultationLabRequestListCreateView.as_view(), name="consultation-lab-requests"),
]
