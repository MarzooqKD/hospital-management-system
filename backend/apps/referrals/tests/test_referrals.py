import datetime

import pytest
from rest_framework.test import APIClient

from apps.core.models import Department, Hospital
from apps.patients.models import Patient
from apps.queues.models import Queue, Visit
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
def department(hospital):
    return Department.objects.create(hospital=hospital, name="General Outpatient")


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
def doctor(hospital):
    role = _make_role_with_grants(
        Role.Name.DOCTOR, [("referrals", "view"), ("referrals", "create"), ("referrals", "edit")]
    )
    return User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def receptionist(hospital):
    role = _make_role_with_grants(Role.Name.RECEPTIONIST, [("referrals", "view")])
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def visit(hospital, patient, department, doctor):
    visit = Visit.objects.create(
        hospital=hospital, patient=patient, department=department, created_by=doctor
    )
    Queue.objects.create(hospital=hospital, visit=visit, queue_number=1)
    return visit


@pytest.mark.django_db
def test_doctor_can_create_a_referral(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)

    response = client.post(
        f"/api/v1/visits/{visit.id}/referrals/",
        {
            "referral_type": "external",
            "destination": "Korle Bu Teaching Hospital — Cardiology",
            "reason": "Suspected cardiac condition requiring specialist review.",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.data["status"] == "pending"


@pytest.mark.django_db
def test_referral_cannot_skip_straight_to_completed(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)
    created = client.post(
        f"/api/v1/visits/{visit.id}/referrals/",
        {"referral_type": "internal", "destination": "Maternity", "reason": "High-risk pregnancy"},
        format="json",
    ).data

    response = client.patch(
        f"/api/v1/referrals/{created['id']}/", {"status": "completed"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_referral_accepted_then_completed(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)
    created = client.post(
        f"/api/v1/visits/{visit.id}/referrals/",
        {"referral_type": "internal", "destination": "Maternity", "reason": "High-risk pregnancy"},
        format="json",
    ).data

    accepted = client.patch(
        f"/api/v1/referrals/{created['id']}/", {"status": "accepted"}, format="json"
    )
    assert accepted.status_code == 200

    completed = client.patch(
        f"/api/v1/referrals/{created['id']}/", {"status": "completed"}, format="json"
    )
    assert completed.status_code == 200


@pytest.mark.django_db
def test_role_without_referrals_permission_cannot_create(receptionist, visit):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        f"/api/v1/visits/{visit.id}/referrals/",
        {"referral_type": "internal", "destination": "Maternity", "reason": "test"},
        format="json",
    )

    assert response.status_code == 403
