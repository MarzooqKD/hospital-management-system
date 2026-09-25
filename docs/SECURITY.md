# Security

Compliance frame: Ghana's Data Protection Act, 2012 (Act 843) — not legal
advice, but the reason audit logging and access control are load-bearing
here, not optional polish.

## Implemented (Phase 0)

- Argon2 password hashing configured ahead of Django's PBKDF2 default.
- `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` — every new endpoint is
  locked down unless it explicitly opts out (`/health/` is the only current
  exception).
- Secrets sourced from `.env` via django-environ; `.env` is gitignored,
  `.env.example` documents the shape with placeholder values only.
- CORS restricted to an explicit allow-list (`CORS_ALLOWED_ORIGINS`), not
  wildcard. Verified with the real preflight (`OPTIONS`) and cross-origin
  request a browser at `localhost:5173` actually sends, not just same-origin
  curl.
- JWT auth (`djangorestframework-simplejwt`): 15-minute access token,
  7-day rotating refresh token, blacklist on logout and on each rotation
  (`rest_framework_simplejwt.token_blacklist`). Verified: a blacklisted
  refresh token is rejected with 401 on reuse.
- RBAC enforcement via `apps.core.permissions.HasModulePermission`, checking
  the user's `Role` against `Permission`/`RolePermission` (see
  `docs/RBAC.md`) — server-side only; frontend nav visibility is UX
  convenience, never the security boundary (CLAUDE.md §9). Enforced on
  `users`, `patients`, `appointments`, `queue`, `vitals`, `consultation`,
  `laboratory`, `pharmacy`, `inventory`, `admissions`, and
  `referrals` modules; the mechanism is generic and reused as each further
  module ships. Two endpoints deliberately bypass the generic
  HTTP-method→action mapping where it would produce the wrong grant
  (dispensing's stock side effect and recording an inventory transaction)
  — see `docs/RBAC.md`'s design notes.
- Audit logging: append-only `AuditLog` (`apps.audit`), wired into login
  (both `login_success` and `login_failed`, the latter with no actor),
  logout, patient create/update, appointment create/update/cancel, patient
  check-in, queue status changes, consultation start/update/complete,
  diagnosis creation, medical record **access** (a `GET`, not just a
  write — CLAUDE.md §8 names "medical record access" specifically), lab
  request creation/status-change/result-recorded/result-validated,
  prescription/prescription-item creation, medication dispensing, patient
  admission, admission transfer, patient discharge, and referral
  creation/status-change. Extended further as the Reports app lands — see
  CLAUDE.md §8 for the full required list. No update/delete path exposed
  to any role, including System Admin (enforced in `ModelAdmin` too, not
  just the API — `Consultation`, `MedicalRecord`, `LaboratoryResult`, and
  `InventoryTransaction` admin registrations block delete/change the same
  way `AuditLog`'s already did). Invoice/payment audit actions existed
  through Phase 4 (`apps.billing`) and were removed with that app on
  2026-09-08 — CLAUDE.md §17.
  `before`/`after` use `DjangoJSONEncoder` so UUID/datetime values from
  serializer output don't crash the write (an early bug — a plain
  `JSONField` chokes on a raw `uuid.UUID`).
- Custom exception handler (`apps.core.exceptions.hide_internal_errors`)
  strips internal detail from unhandled-error responses outside `DEBUG`.
- IDOR/hospital-isolation: every hospital-scoped queryset (`Patient`,
  `Appointment`, `Visit`, `Queue`, `LaboratoryRequest`, `Prescription`,
  `InventoryItem`, `Admission`) filters by `request.user.hospital`
  at the query level, not just at render time — a staff member from another
  hospital gets a plain 404 fetching a record by guessed UUID, not a 403
  that would confirm the ID's existence. Covered by tests
  (`test_staff_cannot_fetch_another_hospitals_patient_by_id`,
  `test_visit_detail_is_hospital_scoped`,
  `test_medical_record_list_hospital_scoped`,
  `test_lab_request_creation_is_hospital_scoped`).
- Cross-hospital write validation: booking an appointment, or checking a
  patient into the queue, with a patient/department/appointment from a
  different hospital than the requester's is rejected in the serializer,
  not just filtered out of what the UI happens to show.
- Business-rule / state-machine validation as a security-adjacent control,
  not just UX: Queue and LaboratoryRequest status transitions are
  allow-listed (`waiting→in_consultation→completed`, either state
  `→cancelled`, nothing else; `requested→sample_collected→cancelled`,
  nothing skips straight to `completed`) rather than accepting any status
  value; a completed Consultation rejects further edits and further
  diagnoses/prescription items at the view/serializer level. Dispensing
  medication checks two independent ceilings (remaining on the
  prescription, and real stock under a row lock) — the adversarial
  over-dispensing case named in CLAUDE.md §12.
- Result confidentiality until validated: an unvalidated
  `LaboratoryResult`'s value is hidden from every role except Lab
  Technician (`LaboratoryResultSerializer.to_representation`) — a doctor
  can see that sample collection/result entry happened, but not treat a
  draft reading as final.
- Bed double-booking is a hard DB constraint, not just an application
  check: `unique_active_admission_per_bed` (`condition=Q(status="admitted")`)
  on `Admission` means even a race between two concurrent admit requests
  can't both succeed — CLAUDE.md §12 names "double bed assignment" as an
  adversarial case explicitly. `Referral` follows the same
  allow-listed-transition and cancel-not-delete pattern already
  established for `Queue`/`LaboratoryRequest`/`Appointment`.
- Role-aware frontend navigation and routing (CLAUDE.md §9: "a pharmacist
  should never even see admin-only modules in the nav"): `GET
  /users/me/` serializes `User.permitted_modules()` — the same
  module→action grants `HasModulePermission` already checks server-side,
  computed from `Role.permissions`, not a second hand-copied table — as a
  `permissions` field. `AppLayout`'s sidebar filters `NAV_ITEMS` to modules
  where the signed-in user holds `<module>.view`, and every module route
  (`/patients`, `/admissions`, etc.) is wrapped in `RequireModule`
  (`frontend/src/routes/RequireModule.tsx`), which shows an "Access
  restricted" message instead of the page for a direct/bookmarked URL a
  role lacks the grant for. This is still a UX layer, not the security
  boundary — the backend 403s the same request either way — but the nav
  and direct-navigation gap CLAUDE.md named is now closed rather than
  merely documented.

## Planned, not yet built

- Object-level permission checks on other detail views as they're added
  (the pattern above — hospital-scoped queryset + serializer-level
  cross-hospital rejection — is the template to repeat).
- Rate limiting on auth endpoints (DRF throttling).

## Mock integration boundary

`InsuranceProviderInterface`, `PaymentGateway`, `NotificationGateway` are the
only three seams allowed to represent an external Ghanaian integration
(NHIS, Mobile Money, SMS), and each ships with a mock implementation only.
Nothing in this codebase calls, or fabricates, a real NHIS/MoMo/SMS-aggregator
endpoint — see CLAUDE.md §4. `InsuranceProviderInterface` (Phase 1) is
built; `PaymentGateway` (`apps.billing.gateways.MockPaymentGateway`) was
built in Phase 4 and removed along with the rest of `apps.billing` on
2026-09-08 per explicit user decision (CLAUDE.md §17) — Mobile Money
remains valid Ghana-specific architecture (§4) if billing is ever rebuilt,
it just isn't exercised by any code today. `NotificationGateway` is the
one seam still not implemented.
