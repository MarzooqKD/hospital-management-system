from django.urls import path

from .views import DepartmentListView, health_check

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("departments/", DepartmentListView.as_view(), name="department-list"),
]
