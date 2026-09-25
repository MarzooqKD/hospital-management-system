import datetime

import pytest
from rest_framework.test import APIClient

from apps.core.models import Hospital
from apps.patients.models import Patient
from apps.users.models import Permission, Role, RolePermission, User

PASSWORD = "TestPass123!"
VALID_PATIENT = {
    "first_name": "Ama",
    "last_name": "Mensah",
    "date_of_birth": "1990-05-12",
    "gender": "female",
    "phone": "024 123 4567",
}


def _login(client, email):
    tokens = client.post(
        "/api/v1/auth/token/", {"email": email, "password": PASSWORD}, format="json"
    ).data
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return tokens


@pytest.fixture
def hospital():
    return Hospital.objects.create(name="Test Hospital")


@pytest.fixture
def other_hospital():
    return Hospital.objects.create(name="Other Hospital")


def _make_role_with_grants(name, grants):
    # get_or_create: Role.name is globally unique, and a test may need the
    # same role (e.g. two receptionists at different hospitals) more than once.
    role, _ = Role.objects.get_or_create(name=name)
    for module, action in grants:
        perm, _ = Permission.objects.get_or_create(module=module, action=action)
        RolePermission.objects.get_or_create(role=role, permission=perm)
    return role


@pytest.fixture
def receptionist(hospital):
    role = _make_role_with_grants(
        Role.Name.RECEPTIONIST,
        [("patients", "view"), ("patients", "create"), ("patients", "edit")],
    )
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def doctor_no_edit(hospital):
    role = _make_role_with_grants(Role.Name.DOCTOR, [("patients", "view")])
    return User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def other_hospital_receptionist(other_hospital):
    role = _make_role_with_grants(
        Role.Name.RECEPTIONIST,
        [("patients", "view"), ("patients", "create"), ("patients", "edit")],
    )
    return User.objects.create_user(
        email="reception@other.hms.gh", password=PASSWORD, role=role, hospital=other_hospital
    )


@pytest.mark.django_db
def test_receptionist_can_register_a_patient(receptionist):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post("/api/v1/patients/", VALID_PATIENT, format="json")

    assert response.status_code == 201
    assert response.data["patient_number"] == "PAT-000001"
    assert response.data["phone"] == "+233241234567"


@pytest.mark.django_db
def test_patient_number_increments_per_hospital(receptionist):
    client = APIClient()
    _login(client, receptionist.email)

    first = client.post("/api/v1/patients/", VALID_PATIENT, format="json")
    second = client.post(
        "/api/v1/patients/", {**VALID_PATIENT, "first_name": "Kwesi"}, format="json"
    )

    assert first.data["patient_number"] == "PAT-000001"
    assert second.data["patient_number"] == "PAT-000002"


@pytest.mark.django_db
def test_invalid_local_phone_number_is_rejected(receptionist):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        "/api/v1/patients/", {**VALID_PATIENT, "phone": "12345"}, format="json"
    )

    assert response.status_code == 400
    assert "phone" in response.data


@pytest.mark.django_db
def test_invalid_ghana_card_format_is_rejected(receptionist):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        "/api/v1/patients/",
        {**VALID_PATIENT, "ghana_card_number": "not-a-card"},
        format="json",
    )

    assert response.status_code == 400
    assert "ghana_card_number" in response.data


@pytest.mark.django_db
def test_duplicate_ghana_card_in_same_hospital_is_rejected(receptionist):
    client = APIClient()
    _login(client, receptionist.email)
    card = "GHA-123456789-0"

    first = client.post(
        "/api/v1/patients/", {**VALID_PATIENT, "ghana_card_number": card}, format="json"
    )
    second = client.post(
        "/api/v1/patients/",
        {**VALID_PATIENT, "first_name": "Kwesi", "ghana_card_number": card},
        format="json",
    )

    assert first.status_code == 201
    assert second.status_code == 400
    assert "ghana_card_number" in second.data


@pytest.mark.django_db
def test_role_without_create_permission_gets_403(doctor_no_edit):
    client = APIClient()
    _login(client, doctor_no_edit.email)

    response = client.post("/api/v1/patients/", VALID_PATIENT, format="json")

    assert response.status_code == 403


@pytest.mark.django_db
def test_staff_cannot_see_another_hospitals_patients(
    receptionist, other_hospital_receptionist, hospital
):
    Patient.objects.create(
        hospital=hospital,
        patient_number="PAT-000001",
        first_name="Ama",
        last_name="Mensah",
        date_of_birth=datetime.date(1990, 5, 12),
        gender="female",
        phone="+233241234567",
    )

    client = APIClient()
    _login(client, other_hospital_receptionist.email)

    response = client.get("/api/v1/patients/")

    assert response.status_code == 200
    assert response.data["count"] == 0


@pytest.mark.django_db
def test_staff_cannot_fetch_another_hospitals_patient_by_id(
    receptionist, other_hospital_receptionist, hospital
):
    patient = Patient.objects.create(
        hospital=hospital,
        patient_number="PAT-000001",
        first_name="Ama",
        last_name="Mensah",
        date_of_birth=datetime.date(1990, 5, 12),
        gender="female",
        phone="+233241234567",
    )

    client = APIClient()
    _login(client, other_hospital_receptionist.email)

    response = client.get(f"/api/v1/patients/{patient.id}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_deleting_a_patient_is_a_soft_delete_that_hides_them_from_the_default_list(
    receptionist, hospital
):
    patient = Patient.objects.create(
        hospital=hospital,
        patient_number="PAT-000001",
        first_name="Ama",
        last_name="Mensah",
        date_of_birth=datetime.date(1990, 5, 12),
        gender="female",
        phone="+233241234567",
    )
    client = APIClient()
    _login(client, receptionist.email)

    deleted = client.patch(
        f"/api/v1/patients/{patient.id}/", {"is_active": False}, format="json"
    )
    assert deleted.status_code == 200
    assert deleted.data["is_active"] is False

    # The row is still there, not actually removed from the database.
    patient.refresh_from_db()
    assert patient.is_active is False

    default_list = client.get("/api/v1/patients/")
    assert default_list.data["count"] == 0

    with_deleted = client.get("/api/v1/patients/?include_deleted=true")
    assert with_deleted.data["count"] == 1

    # Still directly reachable by id — the detail/restore page depends on this.
    detail = client.get(f"/api/v1/patients/{patient.id}/")
    assert detail.status_code == 200
    assert detail.data["is_active"] is False


@pytest.mark.django_db
def test_restoring_a_deleted_patient_brings_them_back_into_the_default_list(
    receptionist, hospital
):
    patient = Patient.objects.create(
        hospital=hospital,
        patient_number="PAT-000001",
        first_name="Ama",
        last_name="Mensah",
        date_of_birth=datetime.date(1990, 5, 12),
        gender="female",
        phone="+233241234567",
        is_active=False,
    )
    client = APIClient()
    _login(client, receptionist.email)

    restored = client.patch(
        f"/api/v1/patients/{patient.id}/", {"is_active": True}, format="json"
    )
    assert restored.status_code == 200
    assert restored.data["is_active"] is True

    default_list = client.get("/api/v1/patients/")
    assert default_list.data["count"] == 1
