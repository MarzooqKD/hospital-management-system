import pytest
from rest_framework.test import APIClient

from apps.core.models import Hospital
from apps.inventory.models import InventoryItem
from apps.users.models import Permission, Role, RolePermission, User

PASSWORD = "TestPass123!"


def _login(client, email):
    tokens = client.post(
        "/api/v1/auth/token/", {"email": email, "password": PASSWORD}, format="json"
    ).data
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")


def _make_role_with_grants(name, grants):
    role, _ = Role.objects.get_or_create(name=name)
    for module, action in grants:
        perm, _ = Permission.objects.get_or_create(module=module, action=action)
        RolePermission.objects.get_or_create(role=role, permission=perm)
    return role


@pytest.fixture
def hospital():
    return Hospital.objects.create(name="Test Hospital")


@pytest.fixture
def hospital_admin(hospital):
    role = _make_role_with_grants(
        Role.Name.HOSPITAL_ADMIN,
        [("inventory", "view"), ("inventory", "create"), ("inventory", "edit")],
    )
    return User.objects.create_user(
        email="hospadmin@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def pharmacist(hospital):
    role = _make_role_with_grants(
        Role.Name.PHARMACIST, [("inventory", "view"), ("inventory", "edit")]
    )
    return User.objects.create_user(
        email="pharmacist@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def item(hospital):
    return InventoryItem.objects.create(
        hospital=hospital,
        name="Gauze bandage",
        category=InventoryItem.Category.CONSUMABLE,
        unit="roll",
        quantity_on_hand=20,
        reorder_level=10,
    )


@pytest.mark.django_db
def test_hospital_admin_can_create_an_inventory_item(hospital_admin, hospital):
    client = APIClient()
    _login(client, hospital_admin.email)

    response = client.post(
        "/api/v1/inventory/items/",
        {"name": "Surgical gloves", "category": "consumable", "unit": "box", "reorder_level": 5},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["quantity_on_hand"] == 0


@pytest.mark.django_db
def test_pharmacist_cannot_create_a_new_catalogue_item(pharmacist):
    client = APIClient()
    _login(client, pharmacist.email)

    response = client.post(
        "/api/v1/inventory/items/",
        {"name": "Surgical gloves", "category": "consumable", "unit": "box"},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_pharmacist_can_record_a_received_transaction_despite_no_create_grant(pharmacist, item):
    """docs/RBAC.md: Pharmacist holds inventory.edit, not inventory.create —
    recording a stock movement is treated as an edit of the item's stock
    level, checked explicitly rather than via the generic POST→create
    mapping (see InventoryTransactionListCreateView)."""
    client = APIClient()
    _login(client, pharmacist.email)

    response = client.post(
        f"/api/v1/inventory/items/{item.id}/transactions/",
        {"transaction_type": "received", "quantity": 50, "batch_number": "B100"},
        format="json",
    )

    assert response.status_code == 201
    item.refresh_from_db()
    assert item.quantity_on_hand == 70


@pytest.mark.django_db
def test_issuing_more_than_available_stock_is_rejected(pharmacist, item):
    client = APIClient()
    _login(client, pharmacist.email)

    response = client.post(
        f"/api/v1/inventory/items/{item.id}/transactions/",
        {"transaction_type": "issued", "quantity": 999},
        format="json",
    )

    assert response.status_code == 400
    item.refresh_from_db()
    assert item.quantity_on_hand == 20


@pytest.mark.django_db
def test_negative_adjustment_reduces_stock(pharmacist, item):
    client = APIClient()
    _login(client, pharmacist.email)

    response = client.post(
        f"/api/v1/inventory/items/{item.id}/transactions/",
        {"transaction_type": "adjusted", "quantity": -3, "notes": "damaged stock"},
        format="json",
    )

    assert response.status_code == 201
    item.refresh_from_db()
    assert item.quantity_on_hand == 17


@pytest.mark.django_db
def test_low_stock_filter(hospital_admin, hospital, item):
    InventoryItem.objects.create(
        hospital=hospital,
        name="Low stock bandage",
        category=InventoryItem.Category.CONSUMABLE,
        unit="roll",
        quantity_on_hand=2,
        reorder_level=10,
    )
    InventoryItem.objects.create(
        hospital=hospital,
        name="Paracetamol syrup",
        category=InventoryItem.Category.MEDICATION,
        unit="bottle",
        quantity_on_hand=50,
        reorder_level=10,
    )
    client = APIClient()
    _login(client, hospital_admin.email)

    response = client.get("/api/v1/inventory/items/?low_stock=true")

    names = [i["name"] for i in response.data["results"]]
    assert "Low stock bandage" in names
    assert "Gauze bandage" not in names
    assert "Paracetamol syrup" not in names
