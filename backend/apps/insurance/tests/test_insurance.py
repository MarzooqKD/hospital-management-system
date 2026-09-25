import datetime

import pytest
from rest_framework.test import APIClient

from apps.core.models import Hospital
from apps.insurance.providers import MockNHISProvider, get_provider
from apps.patients.models import Patient
from apps.users.models import Permission, Role, RolePermission, User

PASSWORD = "TestPass123!"


def _login(client, email):
    tokens = client.post(
        "/api/v1/auth/token/", {"email": email, "password": PASSWORD}, format="json"
    ).data
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")


@pytest.fixture
def hospital():
    return Hospital.objects.create(name="Test Hospital")


@pytest.fixture
def patient(hospital):
    return Patient.objects.create(
        hospital=hospital,
        patient_number="PAT-000001",
        first_name="Ama",
        last_name="Mensah",
        date_of_birth=datetime.date(1990, 5, 12),
        gender="female",
        phone="+233241234567",
    )


@pytest.fixture
def receptionist(hospital):
    role = Role.objects.create(name=Role.Name.RECEPTIONIST)
    for module, action in [("patients", "view"), ("patients", "create")]:
        perm, _ = Permission.objects.get_or_create(module=module, action=action)
        RolePermission.objects.create(role=role, permission=perm)
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


def test_mock_nhis_provider_reports_eligible_for_a_plausible_member_id():
    result = MockNHISProvider().check_eligibility("NHIS123456")
    assert result.eligible is True


def test_mock_nhis_provider_reports_ineligible_for_a_too_short_id():
    result = MockNHISProvider().check_eligibility("AB")
    assert result.eligible is False


def test_get_provider_raises_for_an_unconfigured_provider_type():
    with pytest.raises(NotImplementedError):
        get_provider("private")


@pytest.mark.django_db
def test_add_and_verify_insurance_via_the_api(receptionist, patient):
    client = APIClient()
    _login(client, receptionist.email)

    created = client.post(
        f"/api/v1/patients/{patient.id}/insurance/",
        {
            "provider_type": "nhis",
            "provider_name": "NHIS",
            "policy_number": "POL-1",
            "member_id": "NHIS999999",
        },
        format="json",
    )
    assert created.status_code == 201

    verify = client.get(
        f"/api/v1/patients/{patient.id}/insurance/{created.data['id']}/verify/"
    )
    assert verify.status_code == 200
    assert verify.data["eligible"] is True
