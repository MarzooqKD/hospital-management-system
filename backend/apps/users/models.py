from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import TimestampedModel, UUIDModel


class Permission(TimestampedModel):
    """A (module, action) pair. See docs/RBAC.md for the full target module
    list — modules are added here as their app ships, not speculatively."""

    class Module(models.TextChoices):
        USERS = "users", "Users & Roles"
        AUDIT = "audit", "Audit Log"
        PATIENTS = "patients", "Patient Records"
        APPOINTMENTS = "appointments", "Appointments"
        QUEUE = "queue", "Queue"
        VITALS = "vitals", "Vitals"
        CONSULTATION = "consultation", "Consultation"
        LABORATORY = "laboratory", "Laboratory"
        PHARMACY = "pharmacy", "Pharmacy"
        INVENTORY = "inventory", "Inventory"
        ADMISSIONS = "admissions", "Admissions"
        REFERRALS = "referrals", "Referrals"

    class Action(models.TextChoices):
        VIEW = "view", "View"
        CREATE = "create", "Create"
        EDIT = "edit", "Edit"
        DELETE = "delete", "Delete"

    module = models.CharField(max_length=30, choices=Module.choices)
    action = models.CharField(max_length=10, choices=Action.choices)

    class Meta:
        unique_together = ("module", "action")
        ordering = ["module", "action"]

    def __str__(self):
        return f"{self.module}.{self.action}"


class Role(TimestampedModel):
    """One role per User (FK, not M2M) — locked decision, docs/RBAC.md."""

    class Name(models.TextChoices):
        SYSTEM_ADMIN = "system_admin", "System Administrator"
        HOSPITAL_ADMIN = "hospital_admin", "Hospital Administrator"
        DOCTOR = "doctor", "Doctor"
        NURSE = "nurse", "Nurse"
        RECEPTIONIST = "receptionist", "Receptionist"
        LAB_TECHNICIAN = "lab_technician", "Laboratory Technician"
        PHARMACIST = "pharmacist", "Pharmacist"
        PATIENT = "patient", "Patient"

    name = models.CharField(max_length=30, choices=Name.choices, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(
        Permission, through="RolePermission", related_name="roles"
    )

    def __str__(self):
        return self.get_name_display()


class RolePermission(models.Model):
    """Pure config join — the one table where a hard CASCADE delete is
    acceptable (docs/ARCHITECTURE.md "Deletion policy")."""

    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="role_permissions"
    )
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="role_permissions"
    )

    class Meta:
        unique_together = ("role", "permission")


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser, UUIDModel, TimestampedModel):
    """Staff account. Patients are not modeled as User rows in Phase 0b —
    the Patient portal is future work (CLAUDE.md section 14)."""

    username = None
    email = models.EmailField(unique=True)
    hospital = models.ForeignKey(
        "core.Hospital",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
        help_text="Null for System Administrator accounts (platform-level, not hospital-scoped).",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
    )
    phone = models.CharField(max_length=20, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email

    def has_module_permission(self, module: str, action: str) -> bool:
        if self.is_superuser:
            return True
        if self.role_id is None:
            return False
        return self.role.permissions.filter(module=module, action=action).exists()

    def permitted_modules(self) -> dict[str, list[str]]:
        """Module -> granted actions, for the frontend to gate nav/routes on.
        Mirrors has_module_permission()'s rules exactly (superuser bypass,
        no role = no access) so the two can never disagree."""
        if self.is_superuser:
            return {module: list(Permission.Action.values) for module in Permission.Module.values}
        if self.role_id is None:
            return {}
        grants: dict[str, list[str]] = {}
        for module, action in self.role.permissions.values_list("module", "action"):
            grants.setdefault(module, []).append(action)
        return grants
