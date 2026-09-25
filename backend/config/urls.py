from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.core.urls")),
    path("api/v1/auth/", include("apps.authentication.urls")),
    path("api/v1/users/", include("apps.users.urls")),
    path("api/v1/patients/", include("apps.patients.urls")),
    path("api/v1/patients/<uuid:patient_id>/insurance/", include("apps.insurance.urls")),
    path("api/v1/patients/<uuid:patient_id>/allergies/", include("apps.patients.allergy_urls")),
    path(
        "api/v1/patients/<uuid:patient_id>/medical-records/",
        include("apps.consultations.medical_record_urls"),
    ),
    path("api/v1/appointments/", include("apps.appointments.urls")),
    path("api/v1/queue/", include("apps.queues.urls")),
    path("api/v1/visits/<uuid:visit_id>/", include("apps.queues.visit_urls")),
    path("api/v1/visits/<uuid:visit_id>/", include("apps.consultations.visit_urls")),
    path(
        "api/v1/consultations/<uuid:consultation_id>/diagnoses/",
        include("apps.consultations.diagnosis_urls"),
    ),
    path("api/v1/lab/tests/", include("apps.laboratory.test_catalogue_urls")),
    path(
        "api/v1/consultations/<uuid:consultation_id>/lab-requests/",
        include("apps.laboratory.consultation_urls"),
    ),
    path("api/v1/lab-requests/", include("apps.laboratory.urls")),
    path("api/v1/pharmacy/medications/", include("apps.pharmacy.medication_urls")),
    path(
        "api/v1/consultations/<uuid:consultation_id>/prescription/",
        include("apps.pharmacy.consultation_urls"),
    ),
    path("api/v1/prescriptions/", include("apps.pharmacy.urls")),
    path("api/v1/inventory/suppliers/", include("apps.inventory.supplier_urls")),
    path(
        "api/v1/inventory/items/<uuid:item_id>/transactions/",
        include("apps.inventory.transaction_urls"),
    ),
    path("api/v1/inventory/items/", include("apps.inventory.urls")),
    path("api/v1/visits/<uuid:visit_id>/admission/", include("apps.admissions.visit_urls")),
    path("api/v1/admissions/", include("apps.admissions.urls")),
    path("api/v1/visits/<uuid:visit_id>/referrals/", include("apps.referrals.visit_urls")),
    path("api/v1/referrals/", include("apps.referrals.urls")),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
