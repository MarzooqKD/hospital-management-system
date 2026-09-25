import datetime

import pytest
from rest_framework.test import APIClient

from apps.consultations.models import Consultation
from apps.core.models import Department, Hospital
from apps.inventory.models import InventoryItem
from apps.patients.models import Patient
from apps.pharmacy.models import Medication, PrescriptionItem
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
def medication():
    return Medication.objects.create(name="Paracetamol", strength="500mg", unit="tablet")


@pytest.fixture
def doctor(hospital):
    role = _make_role_with_grants(
        Role.Name.DOCTOR,
        [("consultation", "view"), ("consultation", "create"), ("pharmacy", "view"), ("pharmacy", "create")],
    )
    return User.objects.create_user(
        email="doctor@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def pharmacist(hospital):
    role = _make_role_with_grants(
        Role.Name.PHARMACIST,
        [
            ("pharmacy", "view"),
            ("pharmacy", "create"),
            ("pharmacy", "edit"),
            ("inventory", "view"),
            ("inventory", "edit"),
        ],
    )
    return User.objects.create_user(
        email="pharmacist@test.hms.gh", password=PASSWORD, role=role, hospital=hospital
    )


@pytest.fixture
def consultation(hospital, patient, department, doctor):
    visit = Visit.objects.create(
        hospital=hospital, patient=patient, department=department, created_by=doctor
    )
    Queue.objects.create(hospital=hospital, visit=visit, queue_number=1)
    return Consultation.objects.create(hospital=hospital, visit=visit, doctor=doctor)


def _create_prescription_with_item(doctor_client, consultation, medication, quantity=20):
    started = doctor_client.post(
        f"/api/v1/consultations/{consultation.id}/prescription/", {}, format="json"
    )
    prescription_id = started.data["id"]
    item = doctor_client.post(
        f"/api/v1/prescriptions/{prescription_id}/items/",
        {
            "medication": str(medication.id),
            "dosage": "1 tablet",
            "frequency": "twice daily",
            "duration_days": 5,
            "quantity_prescribed": quantity,
        },
        format="json",
    )
    return prescription_id, item.data["id"]


@pytest.mark.django_db
def test_doctor_can_prescribe_from_a_consultation(doctor, consultation, medication):
    client = APIClient()
    _login(client, doctor.email)

    prescription_id, item_id = _create_prescription_with_item(client, consultation, medication)

    assert prescription_id is not None
    assert item_id is not None


@pytest.mark.django_db
def test_pharmacist_dispenses_against_real_stock(doctor, pharmacist, hospital, consultation, medication):
    InventoryItem.objects.create(
        hospital=hospital, medication=medication, name=medication.name, unit="tablet",
        quantity_on_hand=100,
    )

    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    prescription_id, item_id = _create_prescription_with_item(doctor_client, consultation, medication, quantity=10)

    pharmacist_client = APIClient()
    _login(pharmacist_client, pharmacist.email)
    response = pharmacist_client.post(
        f"/api/v1/prescriptions/{prescription_id}/items/{item_id}/dispense/",
        {"quantity": 10},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == "dispensed"

    item = InventoryItem.objects.get(hospital=hospital, medication=medication)
    assert item.quantity_on_hand == 90


@pytest.mark.django_db
def test_cannot_dispense_more_than_prescribed(doctor, pharmacist, hospital, consultation, medication):
    InventoryItem.objects.create(
        hospital=hospital, medication=medication, name=medication.name, unit="tablet",
        quantity_on_hand=100,
    )
    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    prescription_id, item_id = _create_prescription_with_item(doctor_client, consultation, medication, quantity=10)

    pharmacist_client = APIClient()
    _login(pharmacist_client, pharmacist.email)
    response = pharmacist_client.post(
        f"/api/v1/prescriptions/{prescription_id}/items/{item_id}/dispense/",
        {"quantity": 11},
        format="json",
    )

    assert response.status_code == 400
    item = InventoryItem.objects.get(hospital=hospital, medication=medication)
    assert item.quantity_on_hand == 100


@pytest.mark.django_db
def test_cannot_dispense_more_than_available_stock(doctor, pharmacist, hospital, consultation, medication):
    InventoryItem.objects.create(
        hospital=hospital, medication=medication, name=medication.name, unit="tablet",
        quantity_on_hand=5,
    )
    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    prescription_id, item_id = _create_prescription_with_item(doctor_client, consultation, medication, quantity=10)

    pharmacist_client = APIClient()
    _login(pharmacist_client, pharmacist.email)
    response = pharmacist_client.post(
        f"/api/v1/prescriptions/{prescription_id}/items/{item_id}/dispense/",
        {"quantity": 10},
        format="json",
    )

    assert response.status_code == 400
    item = InventoryItem.objects.get(hospital=hospital, medication=medication)
    assert item.quantity_on_hand == 5


@pytest.mark.django_db
def test_dispensing_without_a_stock_record_is_rejected(doctor, pharmacist, consultation, medication):
    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    prescription_id, item_id = _create_prescription_with_item(doctor_client, consultation, medication)

    pharmacist_client = APIClient()
    _login(pharmacist_client, pharmacist.email)
    response = pharmacist_client.post(
        f"/api/v1/prescriptions/{prescription_id}/items/{item_id}/dispense/",
        {"quantity": 1},
        format="json",
    )

    assert response.status_code == 400
    assert "stock record" in response.data["detail"]


@pytest.mark.django_db
def test_partial_dispense_leaves_item_pending_with_recorded_progress(
    doctor, pharmacist, hospital, consultation, medication
):
    InventoryItem.objects.create(
        hospital=hospital, medication=medication, name=medication.name, unit="tablet",
        quantity_on_hand=100,
    )
    doctor_client = APIClient()
    _login(doctor_client, doctor.email)
    prescription_id, item_id = _create_prescription_with_item(doctor_client, consultation, medication, quantity=10)

    pharmacist_client = APIClient()
    _login(pharmacist_client, pharmacist.email)
    response = pharmacist_client.post(
        f"/api/v1/prescriptions/{prescription_id}/items/{item_id}/dispense/",
        {"quantity": 4},
        format="json",
    )

    assert response.status_code == 200
    item = PrescriptionItem.objects.get(id=item_id)
    assert item.status == PrescriptionItem.Status.PENDING
    assert item.quantity_dispensed == 4
