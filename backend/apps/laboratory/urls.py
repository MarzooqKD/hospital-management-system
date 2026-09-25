from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LaboratoryRequestViewSet, LaboratoryResultValidateView, LaboratoryResultView

router = DefaultRouter()
router.register("", LaboratoryRequestViewSet, basename="lab-request")

urlpatterns = [
    path("<uuid:request_id>/result/", LaboratoryResultView.as_view(), name="lab-request-result"),
    path(
        "<uuid:request_id>/result/validate/",
        LaboratoryResultValidateView.as_view(),
        name="lab-request-result-validate",
    ),
] + router.urls
