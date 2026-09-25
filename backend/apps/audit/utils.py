from .models import AuditLog


def log_action(
    *,
    actor=None,
    action: str,
    entity_type: str = "",
    entity_id: str = "",
    before=None,
    after=None,
    request=None,
) -> AuditLog:
    """Writes one append-only audit row. See CLAUDE.md section 8 for the
    list of events this must cover as each app lands."""
    ip_address = None
    user_agent = ""
    if request is not None:
        ip_address = request.META.get("REMOTE_ADDR")
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:255]

    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else "",
        before=before,
        after=after,
        ip_address=ip_address,
        user_agent=user_agent,
    )
