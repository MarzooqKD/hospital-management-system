from django.core.management.base import BaseCommand
from django.db import transaction

from apps.admissions.models import Bed, Room, Ward
from apps.core.models import Department, Hospital
from apps.inventory.models import InventoryItem
from apps.laboratory.models import LaboratoryTest
from apps.pharmacy.models import Medication
from apps.users.models import Permission, Role, RolePermission, User

# docs/RBAC.md rows for the modules that exist as real endpoints so far.
# Every role not listed here gets no grants (least privilege by default).
# The "Patient" role's V·own on Patient Records/Appointments is deliberately
# omitted — there is no patient-portal link from User to Patient yet
# (CLAUDE.md section 14), and granting a blanket view would be a real bug,
# not a simplification.
GRANTS = {
    Role.Name.SYSTEM_ADMIN: [
        ("users", "view"),
        ("users", "create"),
        ("users", "edit"),
        ("users", "delete"),
        ("audit", "view"),
    ],
    Role.Name.HOSPITAL_ADMIN: [
        ("users", "view"),
        ("users", "create"),
        ("users", "edit"),
        ("audit", "view"),
        ("patients", "view"),
        ("patients", "edit"),
        ("appointments", "view"),
        ("queue", "view"),
        ("vitals", "view"),
        ("consultation", "view"),
        ("laboratory", "view"),
        ("pharmacy", "view"),
        ("inventory", "view"),
        ("inventory", "create"),
        ("inventory", "edit"),
        ("admissions", "view"),
        # docs/RBAC.md: the drafted matrix gives Hospital Admin only "V" on
        # Admissions (admitting a patient is a clinical decision made by
        # Doctor/Nurse), but ward/room/bed *setup* is a hospital-configuration
        # task with no other role positioned to do it — granted here as a
        # flagged, deliberate extension beyond the literal matrix, not a
        # silent one.
        ("admissions", "create"),
        ("referrals", "view"),
    ],
    Role.Name.DOCTOR: [
        ("patients", "view"),
        ("patients", "create"),
        ("appointments", "view"),
        ("appointments", "create"),
        ("appointments", "edit"),
        ("queue", "view"),
        ("vitals", "view"),
        ("consultation", "view"),
        ("consultation", "create"),
        ("consultation", "edit"),
        ("laboratory", "view"),
        ("laboratory", "create"),
        ("pharmacy", "view"),
        ("pharmacy", "create"),
        ("admissions", "view"),
        ("admissions", "create"),
        ("referrals", "view"),
        ("referrals", "create"),
        ("referrals", "edit"),
    ],
    Role.Name.NURSE: [
        ("patients", "view"),
        ("patients", "create"),
        ("appointments", "view"),
        ("queue", "view"),
        ("queue", "create"),
        ("queue", "edit"),
        ("vitals", "view"),
        ("vitals", "create"),
        ("vitals", "edit"),
        ("consultation", "view"),
        ("laboratory", "view"),
        ("laboratory", "create"),
        ("pharmacy", "view"),
        ("inventory", "view"),
        ("admissions", "view"),
        ("admissions", "create"),
        ("referrals", "view"),
    ],
    Role.Name.RECEPTIONIST: [
        ("patients", "view"),
        ("patients", "create"),
        ("patients", "edit"),
        ("appointments", "view"),
        ("appointments", "create"),
        ("appointments", "edit"),
        ("appointments", "delete"),
        ("queue", "view"),
        ("queue", "create"),
        ("queue", "edit"),
        ("admissions", "view"),
        ("referrals", "view"),
    ],
    Role.Name.LAB_TECHNICIAN: [
        ("patients", "view"),
        ("queue", "view"),
        ("laboratory", "view"),
        ("laboratory", "create"),
        ("laboratory", "edit"),
        ("inventory", "view"),
        ("inventory", "edit"),
    ],
    Role.Name.PHARMACIST: [
        ("patients", "view"),
        ("queue", "view"),
        ("consultation", "view"),
        ("pharmacy", "view"),
        ("pharmacy", "create"),
        ("pharmacy", "edit"),
        ("inventory", "view"),
        ("inventory", "edit"),
    ],
}

DEMO_PASSWORD = "DemoPass123!"
DEMO_HOSPITAL_NAME = "Demo Hospital"
DEMO_DEPARTMENTS = ["General Outpatient", "Maternity"]

# (code, name, category) — enough of a catalogue to exercise the Phase 3
# flow locally; not a real Ghanaian hospital's actual test menu.
DEMO_LAB_TESTS = [
    ("MAL-RDT", "Malaria RDT", LaboratoryTest.Category.PARASITOLOGY),
    ("FBC", "Full Blood Count", LaboratoryTest.Category.HEMATOLOGY),
    ("MSU", "Urinalysis", LaboratoryTest.Category.BIOCHEMISTRY),
]

# (name, strength, unit, starting_stock) — starting_stock seeds a matching
# InventoryItem so dispensing has real stock to work against out of the box.
DEMO_MEDICATIONS = [
    ("Paracetamol", "500mg", "tablet", 500),
    ("Amoxicillin", "500mg", "capsule", 200),
    ("Oral Rehydration Salts", "", "sachet", 100),
]


class Command(BaseCommand):
    help = (
        "Seeds the 8 roles, users/audit permissions per docs/RBAC.md, and "
        "one clearly-fake demo account per role for local RBAC testing."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        permissions = {}
        seen = {(m, a) for grants in GRANTS.values() for m, a in grants}
        for module, action in seen:
            perm, _ = Permission.objects.get_or_create(module=module, action=action)
            permissions[(module, action)] = perm

        roles = {}
        for name in Role.Name.values:
            role, _ = Role.objects.get_or_create(name=name)
            roles[name] = role

        for role_name, role in roles.items():
            wanted = {permissions[pair] for pair in GRANTS.get(role_name, [])}
            role.role_permissions.exclude(permission__in=wanted).delete()
            for perm in wanted:
                RolePermission.objects.get_or_create(role=role, permission=perm)

        hospital, _ = Hospital.objects.get_or_create(
            name=DEMO_HOSPITAL_NAME, defaults={"phone": "+233200000000"}
        )

        for dept_name in DEMO_DEPARTMENTS:
            Department.objects.get_or_create(hospital=hospital, name=dept_name)

        for code, name, category in DEMO_LAB_TESTS:
            LaboratoryTest.objects.get_or_create(
                code=code,
                defaults={"name": name, "category": category},
            )

        for name, strength, unit, starting_stock in DEMO_MEDICATIONS:
            medication, _ = Medication.objects.get_or_create(
                name=name, strength=strength, defaults={"unit": unit}
            )
            InventoryItem.objects.get_or_create(
                hospital=hospital,
                medication=medication,
                defaults={
                    "name": f"{name} {strength}".strip(),
                    "category": InventoryItem.Category.MEDICATION,
                    "unit": unit,
                    "quantity_on_hand": starting_stock,
                    "reorder_level": max(10, starting_stock // 10),
                },
            )

        demo_ward, _ = Ward.objects.get_or_create(hospital=hospital, name="Male Ward")
        demo_room, _ = Room.objects.get_or_create(ward=demo_ward, name="101")
        for bed_label in ["A", "B"]:
            Bed.objects.get_or_create(room=demo_room, label=bed_label)

        created = []
        for name, role in roles.items():
            email = f"{name}@demo.hms.gh"
            if User.objects.filter(email=email).exists():
                continue
            User.objects.create_user(
                email=email,
                password=DEMO_PASSWORD,
                first_name=role.get_name_display(),
                role=role,
                hospital=None if name == Role.Name.SYSTEM_ADMIN else hospital,
                is_staff=name in (Role.Name.SYSTEM_ADMIN, Role.Name.HOSPITAL_ADMIN),
            )
            created.append(email)

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(roles)} roles."))
        if created:
            self.stdout.write(
                f"Created {len(created)} demo accounts (password: {DEMO_PASSWORD}):"
            )
            for email in created:
                self.stdout.write(f"  {email}")
        else:
            self.stdout.write("Demo accounts already existed — none created.")
