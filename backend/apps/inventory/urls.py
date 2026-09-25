from rest_framework.routers import DefaultRouter

from .views import InventoryItemViewSet

router = DefaultRouter()
router.register("", InventoryItemViewSet, basename="inventory-item")

urlpatterns = router.urls
