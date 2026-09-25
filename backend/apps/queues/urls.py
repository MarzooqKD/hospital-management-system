from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import QueueCheckInView, QueueViewSet

router = DefaultRouter()
router.register("", QueueViewSet, basename="queue")

urlpatterns = [
    # Must come before router.urls — DRF's default pk pattern (`[^/.]+`)
    # would otherwise swallow "check-in" as a lookup value.
    path("check-in/", QueueCheckInView.as_view(), name="queue-check-in"),
] + router.urls
