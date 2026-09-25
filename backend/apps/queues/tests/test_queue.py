import datetime

import pytest
from rest_framework.test import APIClient

from apps.appointments.models import Appointment
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
def other_hospital():
    return Hospital.objects.create(name="Other Hospital")


@pytest.fixture
def department(hospital):
    return Department.objects.create(hospital=hospital, name="General Outpatient")


def _make_patient(hospital, number="PAT-000001", first="Ama", last="Mensah"):
    return Patient.objects.create(
        hospital=hospital,
        patient_number=number,
        first_name=first,
        last_name=last,
        date_of_birth=datetime.date(1990, 5, 12),
        gender="female",
        phone="+233241234567",
    )


@pytest.fixture
def patient(hospital):
    return _make_patient(hospital)


@pytest.fixture
def receptionist(hospital):
    role = _make_role_with_grants(
        Role.Name.RECEPTIONIST,
        [("patients", "view"), ("queue", "view"), ("queue", "create"), ("queue", "edit")],
    )
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def nurse(hospital):
    role = _make_role_with_grants(
        Role.Name.NURSE,
        [("queue", "view"), ("queue", "create"), ("queue", "edit")],
    )
    return User.objects.create_user(
        email="nurse@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def lab_technician(hospital):
    role = _make_role_with_grants(Role.Name.LAB_TECHNICIAN, [("patients", "view")])
    return User.objects.create_user(
        email="labtech@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.mark.django_db
def test_receptionist_can_check_in_a_walk_in_patient(receptionist, patient, department):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(patient.id), "department": str(department.id)},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["queue_number"] == 1
    assert response.data["status"] == "waiting"


@pytest.mark.django_db
def test_cannot_check_in_a_deleted_patient(receptionist, patient, department):
    patient.is_active = False
    patient.save(update_fields=["is_active"])
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(patient.id), "department": str(department.id)},
        format="json",
    )

    assert response.status_code == 400
    assert "deleted" in str(response.data["patient"][0]).lower()


@pytest.mark.django_db
def test_check_in_with_appointment_marks_appointment_checked_in(
    receptionist, patient, department, hospital
):
    doctor_role = _make_role_with_grants(Role.Name.DOCTOR, [])
    doctor = User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=doctor_role, hospital=hospital
    )
    appointment = Appointment.objects.create(
        hospital=hospital,
        patient=patient,
        department=department,
        doctor=doctor,
        scheduled_at="2026-09-10T09:00:00+00:00",
        created_by=receptionist,
    )

    client = APIClient()
    _login(client, receptionist.email)
    response = client.post(
        "/api/v1/queue/check-in/",
        {
            "patient": str(patient.id),
            "department": str(department.id),
            "appointment": str(appointment.id),
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["doctor"] == doctor.id
    appointment.refresh_from_db()
    assert appointment.status == Appointment.Status.CHECKED_IN


@pytest.mark.django_db
def test_cannot_check_in_same_patient_twice_while_active(receptionist, patient, department):
    client = APIClient()
    _login(client, receptionist.email)
    body = {"patient": str(patient.id), "department": str(department.id)}

    first = client.post("/api/v1/queue/check-in/", body, format="json")
    second = client.post("/api/v1/queue/check-in/", body, format="json")

    assert first.status_code == 201
    assert second.status_code == 400


@pytest.mark.django_db
def test_receptionist_cannot_check_in_patient_from_another_hospital(
    receptionist, department, other_hospital
):
    foreign_patient = _make_patient(other_hospital, number="PAT-100001")

    client = APIClient()
    _login(client, receptionist.email)
    response = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(foreign_patient.id), "department": str(department.id)},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_queue_number_resets_per_department(receptionist, department, hospital):
    other_department = Department.objects.create(hospital=hospital, name="Maternity")
    client = APIClient()
    _login(client, receptionist.email)

    p1 = _make_patient(hospital, number="PAT-000010", first="A")
    p2 = _make_patient(hospital, number="PAT-000011", first="B")
    p3 = _make_patient(hospital, number="PAT-000012", first="C")

    r1 = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(p1.id), "department": str(department.id)},
        format="json",
    )
    r2 = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(p2.id), "department": str(department.id)},
        format="json",
    )
    r3 = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(p3.id), "department": str(other_department.id)},
        format="json",
    )

    assert r1.data["queue_number"] == 1
    assert r2.data["queue_number"] == 2
    assert r3.data["queue_number"] == 1


@pytest.mark.django_db
def test_emergency_priority_sorts_first_in_queue_list(receptionist, department, hospital):
    client = APIClient()
    _login(client, receptionist.email)

    normal_patient = _make_patient(hospital, number="PAT-000020", first="Normal")
    emergency_patient = _make_patient(hospital, number="PAT-000021", first="Emergency")

    client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(normal_patient.id), "department": str(department.id)},
        format="json",
    )
    client.post(
        "/api/v1/queue/check-in/",
        {
            "patient": str(emergency_patient.id),
            "department": str(department.id),
            "priority": "emergency",
        },
        format="json",
    )

    response = client.get("/api/v1/queue/")

    names = [entry["patient_name"] for entry in response.data["results"]]
    assert names == ["Emergency Mensah", "Normal Mensah"]


@pytest.mark.django_db
def test_invalid_status_transition_rejected(receptionist, patient, department):
    client = APIClient()
    _login(client, receptionist.email)
    created = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(patient.id), "department": str(department.id)},
        format="json",
    )

    response = client.patch(
        f"/api/v1/queue/{created.data['id']}/", {"status": "completed"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_nurse_can_call_next_patient(nurse, receptionist, patient, department):
    client = APIClient()
    _login(client, receptionist.email)
    created = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(patient.id), "department": str(department.id)},
        format="json",
    )

    nurse_client = APIClient()
    _login(nurse_client, nurse.email)
    response = nurse_client.patch(
        f"/api/v1/queue/{created.data['id']}/", {"status": "in_consultation"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["status"] == "in_consultation"
    entry = Queue.objects.get(id=created.data["id"])
    assert entry.called_at is not None


@pytest.mark.django_db
def test_visit_detail_is_hospital_scoped(receptionist, patient, department, other_hospital):
    client = APIClient()
    _login(client, receptionist.email)
    created = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(patient.id), "department": str(department.id)},
        format="json",
    )
    visit_id = created.data["visit_id"]

    ok = client.get(f"/api/v1/visits/{visit_id}/")
    assert ok.status_code == 200
    assert ok.data["patient_number"] == patient.patient_number

    foreign_visit = Visit.objects.create(
        hospital=other_hospital,
        patient=_make_patient(other_hospital, number="PAT-900002"),
        department=Department.objects.create(hospital=other_hospital, name="OPD"),
        created_by=receptionist,
    )
    denied = client.get(f"/api/v1/visits/{foreign_visit.id}/")
    assert denied.status_code == 404


@pytest.mark.django_db
def test_role_without_queue_permission_cannot_check_in(lab_technician, patient, department):
    client = APIClient()
    _login(client, lab_technician.email)

    response = client.post(
        "/api/v1/queue/check-in/",
        {"patient": str(patient.id), "department": str(department.id)},
        format="json",
    )

    assert response.status_code == 403
