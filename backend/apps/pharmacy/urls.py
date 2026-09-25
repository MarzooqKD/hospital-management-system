from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DispenseItemView, PrescriptionItemListCreateView, PrescriptionViewSet

router = DefaultRouter()
router.register("", PrescriptionViewSet, basename="prescription")

urlpatterns = [
    path(
        "<uuid:prescription_id>/items/<uuid:item_id>/dispense/",
        DispenseItemView.as_view(),
        name="prescription-item-dispense",
    ),
    path(
        "<uuid:prescription_id>/items/",
        PrescriptionItemListCreateView.as_view(),
        name="prescription-items",
    ),
] + router.urls
