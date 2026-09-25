from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdmissionViewSet,
    BedListCreateView,
    DischargeView,
    RoomListCreateView,
    TransferView,
    WardListCreateView,
)

router = DefaultRouter()
router.register("", AdmissionViewSet, basename="admission")

urlpatterns = [
    path("wards/", WardListCreateView.as_view(), name="ward-list"),
    path("rooms/", RoomListCreateView.as_view(), name="room-list"),
    path("beds/", BedListCreateView.as_view(), name="bed-list"),
    path("<uuid:admission_id>/transfer/", TransferView.as_view(), name="admission-transfer"),
    path("<uuid:admission_id>/discharge/", DischargeView.as_view(), name="admission-discharge"),
] + router.urls
