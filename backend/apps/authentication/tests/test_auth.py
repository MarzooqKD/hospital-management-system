import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.models import Hospital
from apps.users.models import Role, User

PASSWORD = "TestPass123!"


@pytest.fixture
def receptionist():
    role = Role.objects.create(name=Role.Name.RECEPTIONIST)
    hospital = Hospital.objects.create(name="Test Hospital")
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.mark.django_db
def test_login_with_correct_credentials_returns_tokens(receptionist):
    response = APIClient().post(
        "/api/v1/auth/token/",
        {"email": receptionist.email, "password": PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_login_with_correct_credentials_writes_audit_row(receptionist):
    APIClient().post(
        "/api/v1/auth/token/",
        {"email": receptionist.email, "password": PASSWORD},
        format="json",
    )

    entry = AuditLog.objects.get(action="login_success")
    assert entry.actor_id == receptionist.id


@pytest.mark.django_db
def test_login_with_wrong_password_is_rejected_and_audited(receptionist):
    response = APIClient().post(
        "/api/v1/auth/token/",
        {"email": receptionist.email, "password": "wrong-password"},
        format="json",
    )

    assert response.status_code == 401
    entry = AuditLog.objects.get(action="login_failed")
    assert entry.actor is None
    assert entry.after == {"email": receptionist.email}


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(receptionist):
    client = APIClient()
    tokens = client.post(
        "/api/v1/auth/token/",
        {"email": receptionist.email, "password": PASSWORD},
        format="json",
    ).data

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    logout_response = client.post(
        "/api/v1/auth/logout/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert logout_response.status_code == 205

    refresh_response = APIClient().post(
        "/api/v1/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert refresh_response.status_code == 401
