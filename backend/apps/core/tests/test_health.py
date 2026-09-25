import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_check_reports_ok_with_working_database():
    response = APIClient().get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data == {"status": "ok", "database": "connected"}


@pytest.mark.django_db
def test_health_check_requires_no_authentication():
    response = APIClient().get("/api/v1/health/")

    assert response.status_code not in (401, 403)
