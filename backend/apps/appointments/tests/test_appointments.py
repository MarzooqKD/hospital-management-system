import datetime

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.appointments.models import Appointment
from apps.core.models import Department, Hospital
from apps.patients.models import Patient
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
def receptionist(hospital):
    role = _make_role_with_grants(
        Role.Name.RECEPTIONIST,
        [
            ("appointments", "view"),
            ("appointments", "create"),
            ("appointments", "edit"),
            ("appointments", "delete"),
        ],
    )
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def doctor(hospital):
    role = _make_role_with_grants(
        Role.Name.DOCTOR, [("appointments", "view"), ("appointments", "create")]
    )
    return User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


def _future_iso(hours=24):
    return (timezone.now() + datetime.timedelta(hours=hours)).isoformat()


@pytest.mark.django_db
def test_receptionist_can_book_an_appointment(receptionist, patient, department):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        "/api/v1/appointments/",
        {
            "patient": str(patient.id),
            "department": str(department.id),
            "scheduled_at": _future_iso(),
            "reason": "General checkup",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["status"] == "scheduled"


@pytest.mark.django_db
def test_cannot_book_an_appointment_for_a_deleted_patient(receptionist, patient, department):
    patient.is_active = False
    patient.save(update_fields=["is_active"])
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        "/api/v1/appointments/",
        {
            "patient": str(patient.id),
            "department": str(department.id),
            "scheduled_at": _future_iso(),
            "reason": "General checkup",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "deleted" in str(response.data["patient"][0]).lower()


@pytest.mark.django_db
def test_cannot_book_an_appointment_in_the_past(receptionist, patient, department):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        "/api/v1/appointments/",
        {
            "patient": str(patient.id),
            "department": str(department.id),
            "scheduled_at": _future_iso(hours=-24),
        },
        format="json",
    )

    assert response.status_code == 400
    assert "scheduled_at" in response.data


@pytest.mark.django_db
def test_double_booking_the_same_doctor_at_the_same_time_is_rejected(
    receptionist, patient, department, doctor, hospital
):
    doctor.role = Role.objects.get(name=Role.Name.DOCTOR)
    doctor.save()
    when = _future_iso()

    client = APIClient()
    _login(client, receptionist.email)

    first = client.post(
        "/api/v1/appointments/",
        {
            "patient": str(patient.id),
            "department": str(department.id),
            "doctor": str(doctor.id),
            "scheduled_at": when,
        },
        format="json",
    )

    second_patient = Patient.objects.create(
        hospital=hospital,
        patient_number="PAT-000002",
        first_name="Kwesi",
        last_name="Boateng",
        date_of_birth=datetime.date(1985, 1, 1),
        gender="male",
        phone="+233201234567",
    )
    second = client.post(
        "/api/v1/appointments/",
        {
            "patient": str(second_patient.id),
            "department": str(department.id),
            "doctor": str(doctor.id),
            "scheduled_at": when,
        },
        format="json",
    )

    assert first.status_code == 201
    assert second.status_code == 400


@pytest.mark.django_db
def test_cancel_marks_status_cancelled_without_deleting_the_row(
    receptionist, patient, department
):
    client = APIClient()
    _login(client, receptionist.email)

    created = client.post(
        "/api/v1/appointments/",
        {
            "patient": str(patient.id),
            "department": str(department.id),
            "scheduled_at": _future_iso(),
        },
        format="json",
    )
    appointment_id = created.data["id"]

    response = client.delete(f"/api/v1/appointments/{appointment_id}/")

    assert response.status_code == 200
    appointment = Appointment.objects.get(id=appointment_id)
    assert appointment.status == Appointment.Status.CANCELLED


@pytest.mark.django_db
def test_role_without_delete_permission_cannot_cancel(doctor, patient, department):
    client = APIClient()
    _login(client, doctor.email)

    created = client.post(
        "/api/v1/appointments/",
        {
            "patient": str(patient.id),
            "department": str(department.id),
            "scheduled_at": _future_iso(),
        },
        format="json",
    )
    appointment_id = created.data["id"]

    response = client.delete(f"/api/v1/appointments/{appointment_id}/")

    assert response.status_code == 403
