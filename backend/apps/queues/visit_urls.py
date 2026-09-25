from django.urls import path

from .views import VisitDetailView

urlpatterns = [
    path("", VisitDetailView.as_view(), name="visit-detail"),
]
