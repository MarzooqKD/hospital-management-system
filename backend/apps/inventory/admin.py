from django.contrib import admin

from .models import InventoryItem, InventoryTransaction, Supplier


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "contact_person", "phone", "is_active"]
    search_fields = ["name"]


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ["name", "hospital", "category", "quantity_on_hand", "reorder_level", "is_active"]
    list_filter = ["hospital", "category", "is_active"]
    search_fields = ["name"]


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    """Read-only in admin too — append-only means append-only everywhere,
    same as AuditLog."""

    list_display = ["item", "transaction_type", "quantity_change", "performed_by", "created_at"]
    list_filter = ["hospital", "transaction_type"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
