from django.urls import path

from .views import InventoryTransactionListCreateView

urlpatterns = [
    path("", InventoryTransactionListCreateView.as_view(), name="inventory-item-transactions"),
]
