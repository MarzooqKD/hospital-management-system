import pytest
from rest_framework.test import APIClient

from apps.users.models import Permission, Role, RolePermission, User

PASSWORD = "TestPass123!"


def _login(client, email):
    tokens = client.post(
        "/api/v1/auth/token/", {"email": email, "password": PASSWORD}, format="json"
    ).data
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")


@pytest.fixture
def sys_admin():
    role = Role.objects.create(name=Role.Name.SYSTEM_ADMIN)
    perm = Permission.objects.create(module="users", action="view")
    RolePermission.objects.create(role=role, permission=perm)
    return User.objects.create_user(email="admin@test.hms.gh", password=PASSWORD, role=role)


@pytest.fixture
def receptionist():
    role = Role.objects.create(name=Role.Name.RECEPTIONIST)
    return User.objects.create_user(email="reception@test.hms.gh", password=PASSWORD, role=role)


@pytest.mark.django_db
def test_user_with_permission_can_list_users(sys_admin):
    client = APIClient()
    _login(client, sys_admin.email)

    response = client.get("/api/v1/users/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_user_without_permission_gets_403(receptionist):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.get("/api/v1/users/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_unauthenticated_request_gets_401():
    response = APIClient().get("/api/v1/users/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_any_authenticated_user_can_view_own_profile(receptionist):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.get("/api/v1/users/me/")

    assert response.status_code == 200
    assert response.data["email"] == receptionist.email


@pytest.mark.django_db
def test_me_reports_the_users_actual_permission_grants(sys_admin):
    client = APIClient()
    _login(client, sys_admin.email)

    response = client.get("/api/v1/users/me/")

    assert response.data["permissions"] == {"users": ["view"]}


@pytest.mark.django_db
def test_me_reports_no_permissions_for_a_role_with_no_grants(receptionist):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.get("/api/v1/users/me/")

    assert response.data["permissions"] == {}
