from rest_framework.routers import DefaultRouter

from .views import ReferralViewSet

router = DefaultRouter()
router.register("", ReferralViewSet, basename="referral")

urlpatterns = router.urls
