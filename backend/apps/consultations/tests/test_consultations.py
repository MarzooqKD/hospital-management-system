import datetime
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.consultations.models import Consultation, MedicalRecord
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
        Role.Name.DOCTOR,
        [
            ("queue", "view"),
            ("vitals", "view"),
            ("consultation", "view"),
            ("consultation", "create"),
            ("consultation", "edit"),
        ],
    )
    return User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def nurse(hospital):
    role = _make_role_with_grants(
        Role.Name.NURSE,
        [("vitals", "view"), ("vitals", "create"), ("vitals", "edit")],
    )
    return User.objects.create_user(
        email="nurse@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def receptionist(hospital):
    role = _make_role_with_grants(Role.Name.RECEPTIONIST, [("patients", "view")])
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


def _make_visit_with_queue(hospital, patient, department, created_by):
    visit = Visit.objects.create(
        hospital=hospital, patient=patient, department=department, created_by=created_by
    )
    queue_entry = Queue.objects.create(hospital=hospital, visit=visit, queue_number=1)
    return visit, queue_entry


@pytest.fixture
def visit(hospital, patient, department, doctor):
    visit, _ = _make_visit_with_queue(hospital, patient, department, doctor)
    return visit


@pytest.mark.django_db
def test_full_consultation_flow_records_vitals_diagnosis_and_completes(
    doctor, nurse, hospital, patient, department
):
    visit, queue_entry = _make_visit_with_queue(hospital, patient, department, nurse)

    nurse_client = APIClient()
    _login(nurse_client, nurse.email)
    vitals_response = nurse_client.post(
        f"/api/v1/visits/{visit.id}/vitals/",
        {"weight_kg": "70.00", "height_cm": "175.0", "pulse_bpm": 78},
        format="json",
    )
    assert vitals_response.status_code == 201
    assert Decimal(vitals_response.data["bmi"]) == Decimal("22.9")

    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    started = doctor_client.post(
        f"/api/v1/visits/{visit.id}/consultation/",
        {"chief_complaint": "Fever and headache", "symptoms": "Fever, chills"},
        format="json",
    )
    assert started.status_code == 201
    assert started.data["status"] == "in_progress"
    queue_entry.refresh_from_db()
    assert queue_entry.status == Queue.Status.IN_CONSULTATION
    assert queue_entry.called_at is not None

    diagnosis = doctor_client.post(
        f"/api/v1/consultations/{started.data['id']}/diagnoses/",
        {"condition": "Malaria (uncomplicated)", "diagnosis_type": "primary"},
        format="json",
    )
    assert diagnosis.status_code == 201

    complete = doctor_client.post(f"/api/v1/visits/{visit.id}/consultation/complete/")
    assert complete.status_code == 200
    assert complete.data["consultation"]["status"] == "completed"
    assert "Malaria" in complete.data["medical_record"]["diagnosis_summary"]

    visit.refresh_from_db()
    queue_entry.refresh_from_db()
    assert visit.status == Visit.Status.CLOSED
    assert queue_entry.status == Queue.Status.COMPLETED
    assert MedicalRecord.objects.filter(patient=patient, visit=visit).exists()


@pytest.mark.django_db
def test_completing_without_diagnosis_is_rejected(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)
    client.post(f"/api/v1/visits/{visit.id}/consultation/", {}, format="json")

    response = client.post(f"/api/v1/visits/{visit.id}/consultation/complete/")

    assert response.status_code == 400


@pytest.mark.django_db
def test_cannot_edit_completed_consultation(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)
    started = client.post(f"/api/v1/visits/{visit.id}/consultation/", {}, format="json")
    client.post(
        f"/api/v1/consultations/{started.data['id']}/diagnoses/",
        {"condition": "Hypertension", "diagnosis_type": "primary"},
        format="json",
    )
    client.post(f"/api/v1/visits/{visit.id}/consultation/complete/")

    response = client.patch(
        f"/api/v1/visits/{visit.id}/consultation/", {"clinical_notes": "edit"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_second_primary_diagnosis_rejected_but_differential_allowed(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)
    started = client.post(f"/api/v1/visits/{visit.id}/consultation/", {}, format="json")
    url = f"/api/v1/consultations/{started.data['id']}/diagnoses/"

    first = client.post(url, {"condition": "Malaria", "diagnosis_type": "primary"}, format="json")
    second_primary = client.post(
        url, {"condition": "Typhoid", "diagnosis_type": "primary"}, format="json"
    )
    differential = client.post(
        url, {"condition": "Typhoid", "diagnosis_type": "differential"}, format="json"
    )

    assert first.status_code == 201
    assert second_primary.status_code == 400
    assert differential.status_code == 201


@pytest.mark.django_db
def test_diagnosis_cannot_be_added_after_consultation_completed(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)
    started = client.post(f"/api/v1/visits/{visit.id}/consultation/", {}, format="json")
    url = f"/api/v1/consultations/{started.data['id']}/diagnoses/"
    client.post(url, {"condition": "Malaria", "diagnosis_type": "primary"}, format="json")
    client.post(f"/api/v1/visits/{visit.id}/consultation/complete/")

    response = client.post(url, {"condition": "Late add", "diagnosis_type": "differential"}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_role_without_consultation_permission_cannot_start_consultation(receptionist, visit):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(f"/api/v1/visits/{visit.id}/consultation/", {}, format="json")

    assert response.status_code == 403


@pytest.mark.django_db
def test_medical_record_list_hospital_scoped(doctor, other_hospital):
    client = APIClient()
    _login(client, doctor.email)

    foreign_patient = Patient.objects.create(
        hospital=other_hospital,
        patient_number="PAT-900001",
        first_name="Kojo",
        last_name="Owusu",
        date_of_birth=datetime.date(1980, 1, 1),
        gender="male",
        phone="+233201234567",
    )

    response = client.get(f"/api/v1/patients/{foreign_patient.id}/medical-records/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_starting_second_consultation_on_same_visit_rejected(doctor, visit):
    client = APIClient()
    _login(client, doctor.email)
    first = client.post(f"/api/v1/visits/{visit.id}/consultation/", {}, format="json")
    second = client.post(f"/api/v1/visits/{visit.id}/consultation/", {}, format="json")

    assert first.status_code == 201
    assert second.status_code == 400
    assert Consultation.objects.filter(visit=visit).count() == 1


@pytest.mark.django_db
def test_vitals_record_and_return_temperature(nurse, hospital, patient, department):
    visit, _ = _make_visit_with_queue(hospital, patient, department, nurse)
    client = APIClient()
    _login(client, nurse.email)

    created = client.post(
        f"/api/v1/visits/{visit.id}/vitals/",
        {"temperature_celsius": "39.1", "pulse_bpm": 98},
        format="json",
    )
    listed = client.get(f"/api/v1/visits/{visit.id}/vitals/")

    assert created.status_code == 201
    assert Decimal(created.data["temperature_celsius"]) == Decimal("39.1")
    assert Decimal(listed.data["results"][0]["temperature_celsius"]) == Decimal("39.1")
