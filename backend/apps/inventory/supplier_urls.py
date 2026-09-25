from django.urls import path

from .views import SupplierListCreateView

urlpatterns = [
    path("", SupplierListCreateView.as_view(), name="supplier-list"),
]
