from django.urls import path

from .views import LaboratoryTestListView

urlpatterns = [
    path("", LaboratoryTestListView.as_view(), name="lab-test-list"),
]
