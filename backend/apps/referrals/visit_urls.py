from django.urls import path

from .views import VisitReferralListCreateView

urlpatterns = [
    path("", VisitReferralListCreateView.as_view(), name="visit-referrals"),
]
