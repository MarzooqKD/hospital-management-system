import datetime

import pytest
from rest_framework.test import APIClient

from apps.consultations.models import Consultation
from apps.core.models import Department, Hospital
from apps.laboratory.models import LaboratoryRequest, LaboratoryTest
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
def lab_test():
    return LaboratoryTest.objects.create(
        name="Malaria RDT", code="MAL-RDT", category=LaboratoryTest.Category.PARASITOLOGY
    )


@pytest.fixture
def doctor(hospital):
    role = _make_role_with_grants(
        Role.Name.DOCTOR,
        [("consultation", "view"), ("consultation", "create"), ("laboratory", "view"), ("laboratory", "create")],
    )
    return User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def lab_tech(hospital):
    role = _make_role_with_grants(
        Role.Name.LAB_TECHNICIAN,
        [("laboratory", "view"), ("laboratory", "create"), ("laboratory", "edit")],
    )
    return User.objects.create_user(
        email="labtech@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def receptionist(hospital):
    role = _make_role_with_grants(Role.Name.RECEPTIONIST, [("patients", "view")])
    return User.objects.create_user(
        email="reception@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def consultation(hospital, patient, department, doctor):
    visit = Visit.objects.create(
        hospital=hospital, patient=patient, department=department, created_by=doctor
    )
    Queue.objects.create(hospital=hospital, visit=visit, queue_number=1)
    return Consultation.objects.create(hospital=hospital, visit=visit, doctor=doctor)


@pytest.mark.django_db
def test_doctor_can_order_a_lab_test_from_a_consultation(doctor, consultation, lab_test):
    client = APIClient()
    _login(client, doctor.email)

    response = client.post(
        f"/api/v1/consultations/{consultation.id}/lab-requests/",
        {"test": lab_test.id, "notes": "Rule out malaria"},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["status"] == "requested"
    assert response.data["test_code"] == "MAL-RDT"


@pytest.mark.django_db
def test_full_lab_flow_sample_collected_result_entered_then_validated(
    doctor, lab_tech, consultation, lab_test
):
    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    order = doctor_client.post(
        f"/api/v1/consultations/{consultation.id}/lab-requests/",
        {"test": lab_test.id},
        format="json",
    )
    request_id = order.data["id"]

    tech_client = APIClient()
    _login(tech_client, lab_tech.email)

    collected = tech_client.patch(
        f"/api/v1/lab-requests/{request_id}/", {"status": "sample_collected"}, format="json"
    )
    assert collected.status_code == 200

    result = tech_client.post(
        f"/api/v1/lab-requests/{request_id}/result/",
        {"result_value": "Negative", "is_abnormal": False},
        format="json",
    )
    assert result.status_code == 201

    # Doctor sees the pending-validation placeholder, not the raw value yet.
    pending_view = doctor_client.get(f"/api/v1/lab-requests/{request_id}/result/")
    assert pending_view.data["pending_validation"] is True
    assert pending_view.data["result_value"] is None

    validated = tech_client.post(f"/api/v1/lab-requests/{request_id}/result/validate/")
    assert validated.status_code == 200

    lab_request = LaboratoryRequest.objects.get(id=request_id)
    assert lab_request.status == LaboratoryRequest.Status.COMPLETED

    final_view = doctor_client.get(f"/api/v1/lab-requests/{request_id}/result/")
    assert final_view.data["pending_validation"] is False
    assert final_view.data["result_value"] == "Negative"


@pytest.mark.django_db
def test_cannot_skip_straight_from_requested_to_completed(lab_tech, doctor, consultation, lab_test):
    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    order = doctor_client.post(
        f"/api/v1/consultations/{consultation.id}/lab-requests/",
        {"test": lab_test.id},
        format="json",
    )

    tech_client = APIClient()
    _login(tech_client, lab_tech.email)
    response = tech_client.patch(
        f"/api/v1/lab-requests/{order.data['id']}/", {"status": "completed"}, format="json"
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_result_cannot_be_entered_before_sample_collected(lab_tech, doctor, consultation, lab_test):
    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    order = doctor_client.post(
        f"/api/v1/consultations/{consultation.id}/lab-requests/",
        {"test": lab_test.id},
        format="json",
    )

    tech_client = APIClient()
    _login(tech_client, lab_tech.email)
    response = tech_client.post(
        f"/api/v1/lab-requests/{order.data['id']}/result/",
        {"result_value": "Negative"},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_role_without_laboratory_permission_cannot_order_a_test(receptionist, consultation, lab_test):
    client = APIClient()
    _login(client, receptionist.email)

    response = client.post(
        f"/api/v1/consultations/{consultation.id}/lab-requests/",
        {"test": lab_test.id},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_lab_request_creation_is_hospital_scoped(doctor, other_hospital, lab_test):
    other_dept = Department.objects.create(hospital=other_hospital, name="OPD")
    other_patient = Patient.objects.create(
        hospital=other_hospital,
        patient_number="PAT-900001",
        first_name="Kojo",
        last_name="Owusu",
        date_of_birth=datetime.date(1980, 1, 1),
        gender="male",
        phone="+233201234567",
    )
    other_visit = Visit.objects.create(
        hospital=other_hospital, patient=other_patient, department=other_dept, created_by=doctor
    )
    other_consultation = Consultation.objects.create(
        hospital=other_hospital, visit=other_visit, doctor=doctor
    )

    client = APIClient()
    _login(client, doctor.email)
    response = client.post(
        f"/api/v1/consultations/{other_consultation.id}/lab-requests/",
        {"test": lab_test.id},
        format="json",
    )

    assert response.status_code == 404
