from rest_framework.permissions import BasePermission

_METHOD_ACTIONS = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "create",
    "PUT": "edit",
    "PATCH": "edit",
    "DELETE": "delete",
}


class HasModulePermission(BasePermission):
    """RBAC enforcement per docs/RBAC.md. Views set `required_module`;
    the (module, action) pair is checked against the user's Role via
    User.has_module_permission(). Server-side only — CLAUDE.md section 9:
    frontend nav visibility is UX, never the security boundary.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        module = getattr(view, "required_module", None)
        action = _METHOD_ACTIONS.get(request.method)
        if module is None or action is None:
            return False

        return request.user.has_module_permission(module, action)
