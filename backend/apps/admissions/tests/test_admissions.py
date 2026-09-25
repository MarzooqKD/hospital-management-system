import datetime

import pytest
from rest_framework.test import APIClient

from apps.admissions.models import Admission, Bed, Room, Ward
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
def bed(hospital):
    ward = Ward.objects.create(hospital=hospital, name="Male Ward")
    room = Room.objects.create(ward=ward, name="101")
    return Bed.objects.create(room=room, label="A")


def _make_patient(hospital, number="PAT-000001", first="Ama"):
    return Patient.objects.create(
        hospital=hospital,
        patient_number=number,
        first_name=first,
        last_name="Mensah",
        date_of_birth=datetime.date(1990, 5, 12),
        gender="female",
        phone="+233241234567",
    )


@pytest.fixture
def patient(hospital):
    return _make_patient(hospital)


@pytest.fixture
def doctor(hospital):
    role = _make_role_with_grants(
        Role.Name.DOCTOR, [("admissions", "view"), ("admissions", "create")]
    )
    return User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def receptionist(hospital):
    role = _make_role_with_grants(Role.Name.RECEPTIONIST, [("admissions", "view")])
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


def _make_visit(hospital, patient, department, doctor):
    visit = Visit.objects.create(
        hospital=hospital, patient=patient, department=department, created_by=doctor
    )
    Queue.objects.create(hospital=hospital, visit=visit, queue_number=1)
    return visit


@pytest.fixture
def visit(hospital, patient, department, doctor):
    return _make_visit(hospital, patient, department, doctor)


@pytest.mark.django_db
def test_doctor_can_admit_a_patient_to_a_bed(doctor, visit, bed):
    client = APIClient()
    _login(client, doctor.email)

    response = client.post(
        f"/api/v1/visits/{visit.id}/admission/", {"bed": bed.id, "reason": "Malaria, IV fluids"}, format="json"
    )

    assert response.status_code == 201, response.data
    assert response.data["status"] == "admitted"


@pytest.mark.django_db
def test_double_booking_the_same_bed_is_rejected(doctor, hospital, department, bed):
    patient_a = _make_patient(hospital, number="PAT-000010", first="A")
    patient_b = _make_patient(hospital, number="PAT-000011", first="B")
    visit_a = _make_visit(hospital, patient_a, department, doctor)
    visit_b = _make_visit(hospital, patient_b, department, doctor)

    client = APIClient()
    _login(client, doctor.email)

    first = client.post(f"/api/v1/visits/{visit_a.id}/admission/", {"bed": bed.id}, format="json")
    second = client.post(f"/api/v1/visits/{visit_b.id}/admission/", {"bed": bed.id}, format="json")

    assert first.status_code == 201
    assert second.status_code == 400
    assert Admission.objects.filter(bed=bed, status=Admission.Status.ADMITTED).count() == 1


@pytest.mark.django_db
def test_discharge_frees_the_bed_for_a_new_admission(doctor, hospital, department, bed, visit):
    client = APIClient()
    _login(client, doctor.email)
    admission = client.post(
        f"/api/v1/visits/{visit.id}/admission/", {"bed": bed.id}, format="json"
    ).data

    discharge = client.post(
        f"/api/v1/admissions/{admission['id']}/discharge/",
        {"summary": "Recovered, discharged home."},
        format="json",
    )
    assert discharge.status_code == 200
    assert discharge.data["status"] == "discharged"

    other_patient = _make_patient(hospital, number="PAT-000020", first="C")
    other_visit = _make_visit(hospital, other_patient, department, doctor)
    readmit = client.post(
        f"/api/v1/visits/{other_visit.id}/admission/", {"bed": bed.id}, format="json"
    )
    assert readmit.status_code == 201


@pytest.mark.django_db
def test_transfer_to_an_occupied_bed_is_rejected(doctor, hospital, department, visit):
    ward = Ward.objects.create(hospital=hospital, name="Female Ward")
    room = Room.objects.create(ward=ward, name="201")
    bed_a = Bed.objects.create(room=room, label="A")
    bed_b = Bed.objects.create(room=room, label="B")

    other_patient = _make_patient(hospital, number="PAT-000030", first="D")
    other_visit = _make_visit(hospital, other_patient, department, doctor)

    client = APIClient()
    _login(client, doctor.email)
    admission = client.post(
        f"/api/v1/visits/{visit.id}/admission/", {"bed": bed_a.id}, format="json"
    ).data
    client.post(f"/api/v1/visits/{other_visit.id}/admission/", {"bed": bed_b.id}, format="json")

    response = client.post(
        f"/api/v1/admissions/{admission['id']}/transfer/", {"bed": bed_b.id}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_transfer_to_a_free_bed_succeeds(doctor, hospital, department, visit):
    ward = Ward.objects.create(hospital=hospital, name="Female Ward")
    room = Room.objects.create(ward=ward, name="201")
    bed_a = Bed.objects.create(room=room, label="A")
    bed_b = Bed.objects.create(room=room, label="B")

    client = APIClient()
    _login(client, doctor.email)
    admission = client.post(
        f"/api/v1/visits/{visit.id}/admission/", {"bed": bed_a.id}, format="json"
    ).data

    response = client.post(
        f"/api/v1/admissions/{admission['id']}/transfer/", {"bed": bed_b.id}, format="json"
    )

    assert response.status_code == 200
    assert response.data["bed"] == bed_b.id


@pytest.mark.django_db
def test_available_bed_filter_excludes_occupied_beds(doctor, bed, visit):
    client = APIClient()
    _login(client, doctor.email)

    before = client.get("/api/v1/admissions/beds/?available=true")
    assert any(b["id"] == bed.id for b in before.data["results"])

    client.post(f"/api/v1/visits/{visit.id}/admission/", {"bed": bed.id}, format="json")

    after = client.get("/api/v1/admissions/beds/?available=true")
    assert not any(b["id"] == bed.id for b in after.data["results"])


@pytest.mark.django_db
def test_role_without_admissions_permission_cannot_admit(receptionist, visit, bed):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        f"/api/v1/visits/{visit.id}/admission/", {"bed": bed.id}, format="json"
    )

    assert response.status_code == 403
