from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import exception_handler


def hide_internal_errors(exc, context):
    """Wraps DRF's default handler so responses never leak stack traces or
    internal detail outside DEBUG (CLAUDE.md section 8 / docs/SECURITY.md).
    """
    response = exception_handler(exc, context)

    if response is not None:
        return response

    if settings.DEBUG:
        return None  # let Django's debug page show the full traceback

    return Response(
        {"detail": "An unexpected error occurred."},
        status=500,
    )
