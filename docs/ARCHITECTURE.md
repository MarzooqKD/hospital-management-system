# Architecture

Ghana Hospital Management System. See `CLAUDE.md` for the full standing brief; this
file records concrete decisions made during implementation so they don't need
re-deriving each session.

## System shape

A modular monolith: one Django project (`backend/`) with one app per bounded
domain, serving a React SPA (`frontend/`) over a versioned JSON REST API
(`/api/v1/`). One PostgreSQL database. Docker Compose runs all three services
locally; the same images are the deployable unit later.

## Locked decisions

**Primary keys** — UUID for anything patient-facing, cross-module, or exposed
in a URL (this also resists IDOR-by-ID-guessing). Auto-increment only for pure
internal lookup/join tables never used as an external resource id (`Role`,
`Permission`, `RolePermission`, `LaboratoryTest` catalogue, `Supplier`, `Ward`,
`Room`, `Bed`, `AuditLog`).

**Deletion policy** — soft-delete clinical/financial records
(`Patient`, `Consultation`, `Diagnosis`, `Prescription`, `LaboratoryResult`,
`Admission`) with `PROTECT` on inbound FKs. Reference
tables (`Medication`, `InventoryItem`, wards/rooms/beds) deactivate via
`is_active` instead of deleting. `AuditLog` and `InventoryTransaction` are
append-only — no delete path exists. `RolePermission` is the one table where a
hard `CASCADE` delete is acceptable, since it carries no historical meaning.

**RBAC model** — a custom `Role` (single FK on `User`, not M2M) →
`Permission` (M2M via `RolePermission`), layered on Django auth and enforced
only in DRF permission classes. See `docs/RBAC.md` for the full matrix —
treat it as source of truth and update it in the same PR as any permission
change.

**Hospital scoping** — every hospital-relevant table carries a `hospital_id`
FK from day one, even though only one `Hospital` row exists today and no
hospital-switcher UI is built. Multi-hospital support (CLAUDE.md §14) stays a
data-migration problem later, not a schema rewrite.

**Mock integration boundary** — `InsuranceProviderInterface`, `PaymentGateway`,
`NotificationGateway` are the three sanctioned mock seams for Ghana-specific
integrations (NHIS, Mobile Money, SMS). Nothing else calls, or fabricates, a
real external Ghanaian API — see `docs/SECURITY.md` and CLAUDE.md §4.
`PaymentGateway` was built in Phase 4 and removed with the rest of
`apps.billing` on 2026-09-08 (CLAUDE.md §17); `InsuranceProviderInterface`
is the only one of the three currently exercised by any code.

**Timezone** — `Africa/Accra` throughout backend and frontend (Ghana has no
DST).

## Password hashing

Argon2 (`django.contrib.auth.hashers.Argon2PasswordHasher`) is first in
`PASSWORD_HASHERS`, ahead of Django's PBKDF2 default, per CLAUDE.md §8.

## Dependency versions

Pinned exactly as installed, not recalled from memory (CLAUDE.md §3). Current
backend pins: Django 5.2.17, djangorestframework 3.18.0, drf-spectacular
0.30.0, djangorestframework-simplejwt 5.5.1, psycopg2-binary 2.9.12,
django-environ 0.14.0, django-cors-headers 4.9.0, argon2-cffi 25.1.0 — see
`backend/requirements.txt` for the full frozen list.

Frontend gained two dependencies mid-project, both explicitly requested by
the user for a visual redesign rather than substituted unilaterally
(CLAUDE.md §3's "flag before deviating" only applies to *unrequested*
deviations): `tailwindcss` 4.3.3 (via `@tailwindcss/vite` — CSS-first
config in `src/index.css`, no separate `tailwind.config` file needed in
v4) and `lucide-react` 1.41.0 for icons. Tailwind replaces the
hand-written `App.css` used through Phase 3 — that file was deleted once
every page had been rebuilt on the new component library
(`frontend/src/components/ui/`), not left as unused dead weight.

## Design system

Everything from the login page onward is built on a shared component
library (`frontend/src/components/ui/`: `Button`, `Card`, `Badge`/
`StatusPill`, `Table`, `Input`/`Select`/`Textarea`, `Modal`,
`SidebarNavItem`, `Avatar`, `EmptyState`, `Skeleton`), not one-off Tailwind
classes repeated per page. Palette: deep navy (`navy-900`/`950`, custom
scale — sidebar, page headings, primary actions) plus a bright teal accent
(`accent-500`, close to Tailwind's built-in `teal-500`) for contextual
highlights and active states; semantic status colors (emerald/amber/red)
via `StatusPill`, which maps every status string used anywhere in the app
(queue, lab, pharmacy, admission, referral) to one consistent
tone so "green always means done/available" holds everywhere, not
just within one module. One border-radius language throughout: pill-shaped
(`rounded-full`) for buttons/badges, generously rounded (`rounded-2xl`,
16px) for cards/tables. A living style guide showing every component and
color is published at `/design-system` (not linked from nav, not behind
auth) — see that route's page for the fuller rationale on each choice,
including why the login page uses an icon-based illustration rather than a
photo (no photo-sourcing tool available, and CLAUDE.md-adjacent guidance
against fabricating stock imagery). Known gap: the sidebar nav is not yet
role-filtered (see `docs/SECURITY.md`).

## Open questions

Tracked in the planning artifact from the initial planning session
(2026-09-03) — patient numbering scheme across future hospitals, whether
System Admin needs a break-glass emergency-access path, clinical note
visibility for Hospital Admin, and others. Do not silently resolve one of
these mid-implementation; surface it instead.

## Status

- [x] Phase 0 part A — repo scaffolding, health-check round trip
      (`GET /api/v1/health/`) verified against a real Postgres. Verified
      **natively** (Django + Vite dev servers against Homebrew Postgres), not
      via `docker compose up` — this dev machine runs macOS 12 (Monterey),
      which neither Colima/qemu nor Docker Desktop currently support
      (Docker Desktop requires macOS 14+; Homebrew can't build qemu from
      source on macOS 12). `docker-compose.yml` and both Dockerfiles are
      written and reviewed but unverified on this machine — verify on any
      macOS 14+/Linux machine, or once this machine is upgraded.
- [x] Phase 0 part B — `User`/`Role`/`Permission`/`RolePermission` models
      (`apps.users`), `Hospital`/`Department` (`apps.core`), JWT login/
      refresh/logout with rotation + blacklist (`apps.authentication`),
      generic RBAC permission class (`apps.core.permissions.
      HasModulePermission`), append-only `AuditLog` wired into login/logout
      (`apps.audit`), `seed_rbac` management command, custom DRF exception
      handler. 10 backend tests passing (pytest). Frontend: login form
      (React Hook Form + Zod), `AuthContext`, protected routing
      (`react-router-dom`), a dashboard that visibly exercises both the RBAC
      allow and 403 deny paths, 6 passing Vitest + RTL tests (first use of
      the frontend testing stack — `npm test`). Verified natively end-to-end
      (see Phase 0a note on why not Docker) — login, protected-route access,
      401 with no token, 403 for a role without `users.view`, logout +
      blacklisted-token reuse rejected, full CORS preflight for the actual
      cross-origin browser request.
- [x] Phase 1 — `Patient` + `PatientNumberSequence` (`apps.patients`),
      `Insurance` + mock `InsuranceProviderInterface`/`MockNHISProvider`
      (`apps.insurance`), `Appointment` (`apps.appointments`), Department
      seed data. Ghana Card format + Ghanaian phone validation/normalization
      (`apps.core.validators`), hospital-scoped `patient_number` generation,
      hospital-isolation enforced at the queryset and serializer level (not
      just RBAC), double-booking prevention, cancellation-as-status-change.
      27 backend + 13 frontend tests passing. Frontend: patient search/
      register/detail (with insurance + mock eligibility check),
      appointment list/book/cancel, a shared `AppLayout` nav shell (first
      use of `layouts/`). Verified live end-to-end: register a patient with
      a real Ghana Card + local phone number → confirm E.164 normalization
      → add NHIS insurance → verify eligibility (mock) → book an
      appointment — the full Phase 1 exit criterion, run for real, not
      just asserted.
- [x] Phase 2 — `Allergy` (`apps.patients`, carried over from Phase 1's
      deferral); `Visit`/`Queue`/`QueueNumberSequence` (`apps.queues`);
      `VitalSign`/`Consultation`/`Diagnosis`/`MedicalRecord`
      (`apps.consultations`). `Appointment` gained a `checked_in` status.
      RBAC extended to `queue`/`vitals`/`consultation` modules. Daily,
      per-department queue numbering (`select_for_update`-serialized, same
      pattern as `patient_number`); emergency-first queue ordering;
      allow-listed Queue status transitions; one-consultation-per-visit,
      immutable once completed; at most one primary diagnosis per
      consultation; completing a consultation atomically snapshots a
      `MedicalRecord`, closes the `Visit`, and completes the linked
      `Queue`/`Appointment`. 48 backend + 19 frontend tests passing.
      Frontend: check-in flow, a queue board (call/cancel, department
      filter), a visit workspace (vitals entry, consultation notes,
      diagnosis, complete), patient profile extended with allergies and
      medical history. Verified live end-to-end against the running dev
      servers (see Phase 0a note on why native, not Docker): a real
      check-in → vitals → consultation-start → diagnosis → complete →
      medical-record-visible chain, run via the actual HTTP API the
      frontend calls, plus a live CORS preflight check on the new
      check-in endpoint. The UI itself was exercised through its Vitest/RTL
      component tests and a manual build/type-check, not a visual
      click-through in an actual browser — no browser-automation tool was
      available in this session to do that step.
- [x] Phase 3 — `LaboratoryTest`/`LaboratoryRequest`/`LaboratoryResult`
      (`apps.laboratory`); `Medication`/`Prescription`/`PrescriptionItem`
      (`apps.pharmacy`); `Supplier`/`InventoryItem`/`InventoryTransaction`
      (`apps.inventory`). RBAC extended to `laboratory`/`pharmacy`/
      `inventory` modules, including two deliberate deviations from the
      generic HTTP-method→action mapping (dispensing's inventory side
      effect; recording a stock transaction checked as `inventory.edit`,
      not the generic `create`) — see `docs/RBAC.md`. Two-step lab result
      validation with role-gated visibility until validated; allow-listed
      LaboratoryRequest status transitions; one Prescription per
      Consultation; dispensing checked against both the prescription's
      remaining quantity and real stock under a row lock (the
      over-dispensing adversarial case from CLAUDE.md §12);
      `InventoryItem.quantity_on_hand` as a maintained running total that
      only ever changes through an `InventoryTransaction`. 66 backend + 25
      frontend tests passing (up from 48 + 19). Frontend: lab-ordering and
      prescribing added to the visit workspace, a lab technician worklist
      (collect sample → enter result → validate), a pharmacist worklist
      (dispense against real stock), an inventory page (create items,
      record received/issued/adjusted movements, low-stock filter).
      Verified live end-to-end against the running dev servers: a
      diagnosis → lab request → sample collected → result entered →
      validated → doctor sees it chain, and a prescription → dispensed
      against real seeded stock chain with live over-dispense rejection,
      run via the actual HTTP API the frontend calls — plus the full
      Phase 2 chain re-run afterward to confirm consultation completion
      still closes out cleanly with lab/pharmacy attached. Known gap,
      flagged not hidden: frontend nav isn't role-filtered yet (every
      module shows to every role; the backend still enforces every grant).
- [x] Phase 4 — `Invoice`/`InvoiceItem`/`Payment` (`apps.billing`, new
      app); `Ward`/`Room`/`Bed`/`Admission`/`Discharge` (`apps.admissions`,
      new app); `Referral` (`apps.referrals`, new app). RBAC extended to
      `billing`/`admissions`/`referrals` modules, including one flagged
      deviation (Hospital Admin's `admissions.create`, needed for
      ward/bed setup though the matrix gives Hospital Admin only `V` on
      admitting a patient — see `docs/RBAC.md`). Money stored as integer
      pesewas throughout, never float; `LaboratoryTest`/`InventoryItem`
      gained pricing fields deliberately deferred since Phase 3. Invoice
      generation auto-populates line items from what actually happened
      during the visit (consultation fee, completed lab requests,
      dispensed prescription items) rather than a blank form, mirroring
      Phase 2's `MedicalRecord` auto-generation. `PaymentGateway`
      (`apps.billing.gateways`) is the second of the three sanctioned mock
      integration seams to actually get built — cash/insurance post
      directly, mobile money/bank/card route through the mock gateway.
      Bed double-booking is a hard DB constraint
      (`unique_active_admission_per_bed`), not just an application check —
      the CLAUDE.md §12 adversarial case by that name. 89 backend + 30
      frontend tests passing (up from 66 + 25). Verified live end-to-end
      against the running dev servers: a completed consultation → invoice
      generated with the real consultation fee → a manual line item added
      → paid via cash *and* mobile money on the same invoice (proving
      "every configured method") → invoice reaches `paid` → a patient
      admitted to a specific bed → a second admission attempt against the
      same occupied bed correctly rejected (proving "no double-booking").
      **Update, 2026-09-08:** `apps.billing` (Invoice/InvoiceItem/Payment,
      `PaymentGateway`) and the Cashier role were removed entirely per
      explicit user decision — this entry is left as an accurate record of
      what Phase 4 originally built and verified, not of what exists in
      the codebase today. See CLAUDE.md §17 and `docs/ROADMAP.md` for the
      removal itself; `Ward`/`Room`/`Bed`/`Admission`/`Discharge`/
      `Referral` and their RBAC grants are unaffected and remain as
      described above.
- [ ] Phase 5 onward — see `docs/ROADMAP.md`
