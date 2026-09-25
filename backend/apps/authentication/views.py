from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.audit.utils import log_action


class LoginView(TokenObtainPairView):
    """Issues a JWT pair and writes an audit row for both outcomes —
    CLAUDE.md section 8 requires login to be an audited event."""

    permission_classes = [AllowAny]
    serializer_class = TokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except APIException:
            log_action(
                action="login_failed",
                after={"email": request.data.get("email", "")},
                request=request,
            )
            raise

        user = serializer.user
        log_action(
            actor=user,
            action="login_success",
            entity_type="user",
            entity_id=user.id,
            request=request,
        )
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Blacklists the refresh token — CLAUDE.md section 8: token
    blacklisting on logout."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"detail": "refresh is required."}, status=400)

        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            return Response({"detail": "Invalid or already-used token."}, status=400)

        log_action(
            actor=request.user,
            action="logout",
            entity_type="user",
            entity_id=request.user.id,
            request=request,
        )
        return Response(status=status.HTTP_205_RESET_CONTENT)
