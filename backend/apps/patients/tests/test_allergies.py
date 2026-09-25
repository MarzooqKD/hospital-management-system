import datetime

import pytest
from rest_framework.test import APIClient

from apps.core.models import Hospital
from apps.patients.models import Allergy, Patient
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
def other_hospital():
    return Hospital.objects.create(name="Other Hospital")


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
def nurse(hospital):
    # docs/RBAC.md: Nurse has V·C on Patient Records — no edit. Allergy
    # rides under the "patients" module (same as Insurance), so a nurse can
    # record one but not later deactivate it — only Reception/Hosp. Admin
    # (which hold "patients edit") can.
    role = _make_role_with_grants(
        Role.Name.NURSE, [("patients", "view"), ("patients", "create")]
    )
    return User.objects.create_user(
        email="nurse@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def receptionist(hospital):
    role = _make_role_with_grants(
        Role.Name.RECEPTIONIST,
        [("patients", "view"), ("patients", "create"), ("patients", "edit")],
    )
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.mark.django_db
def test_receptionist_can_record_and_deactivate_an_allergy(receptionist, patient):
    client = APIClient()
    _login(client, receptionist.email)

    created = client.post(
        f"/api/v1/patients/{patient.id}/allergies/",
        {"allergen": "Penicillin", "reaction": "Rash", "severity": "moderate"},
        format="json",
    )
    assert created.status_code == 201
    assert created.data["is_active"] is True

    deactivated = client.patch(
        f"/api/v1/patients/{patient.id}/allergies/{created.data['id']}/",
        {"is_active": False},
        format="json",
    )
    assert deactivated.status_code == 200
    assert Allergy.objects.get(id=created.data["id"]).is_active is False


@pytest.mark.django_db
def test_nurse_can_record_but_not_deactivate_an_allergy(nurse, patient):
    client = APIClient()
    _login(client, nurse.email)

    created = client.post(
        f"/api/v1/patients/{patient.id}/allergies/",
        {"allergen": "Sulfa drugs", "severity": "severe"},
        format="json",
    )
    assert created.status_code == 201

    response = client.patch(
        f"/api/v1/patients/{patient.id}/allergies/{created.data['id']}/",
        {"is_active": False},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_cannot_record_allergy_for_patient_in_another_hospital(nurse, other_hospital):
    foreign_patient = Patient.objects.create(
        hospital=other_hospital,
        patient_number="PAT-900001",
        first_name="Kojo",
        last_name="Owusu",
        date_of_birth=datetime.date(1980, 1, 1),
        gender="male",
        phone="+233201234567",
    )
    client = APIClient()
    _login(client, nurse.email)

    response = client.post(
        f"/api/v1/patients/{foreign_patient.id}/allergies/",
        {"allergen": "Sulfa drugs", "severity": "severe"},
        format="json",
    )

    assert response.status_code == 404
