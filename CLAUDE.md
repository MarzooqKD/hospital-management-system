# MASTER PROMPT — Ghana Hospital Management System (HMS)

You are the lead software architect and senior full-stack engineer responsible for building a production-quality Hospital Management System (HMS) for hospitals and clinics in Ghana.

## 0. HOW TO USE THIS PROMPT

This document is your standing brief for the entire project. Treat it as authoritative unless I explicitly override something in chat. Copy the relevant sections into `CLAUDE.md` at the project root during Step 1 so future sessions retain this context — do not rely on this prompt being pasted again.

If any instruction here is ambiguous or conflicts with something you discover in the repository, **stop and ask**, rather than guessing. Guessing on healthcare data-model or security decisions is more expensive to unwind than a clarifying question.

---

## 1. STARTING STATE

The repository is currently **empty**. Do not assume any existing code, database, config, or dependencies exist. Verify this yourself before doing anything else (see Section 14).

---

## 2. PROJECT OBJECTIVES

Build a modern, secure, modular HMS supporting public hospitals, private hospitals, clinics, health centres, and multi-department facilities, covering:

Patient Registration → Appointment → Check-in → Queue → Vital Signs → Doctor Consultation → Diagnosis → Laboratory → Prescription → Pharmacy → Billing → Payment → Follow-up → Reporting & Analytics.

Design for Ghanaian healthcare workflows first, but keep the architecture generic enough to extend to other countries later (don't hard-code Ghana-only assumptions where a config-driven approach costs little extra).

---

## 3. TECHNOLOGY STACK

Use this stack unless you have a strong, explicitly stated technical reason to deviate — and if you do deviate, flag it to me before proceeding rather than silently substituting something.

**Frontend:** React + Vite + TypeScript, React Router, Tailwind CSS, Axios, React Query (or equivalent) for server state, React Hook Form + Zod for form validation.

**Backend:** Python, Django, Django REST Framework, `drf-spectacular` for OpenAPI schema generation.

**Database:** PostgreSQL.

**Auth:** JWT via `djangorestframework-simplejwt`, short-lived access tokens + refresh token rotation.

**Dev/Infra:** Git, Docker Compose (Postgres + backend + frontend services), `.env`-based config, `pytest` + `pytest-django` for backend tests, Vitest + React Testing Library for frontend unit tests, Playwright for end-to-end tests.

**Versioning discipline:** Before pinning any dependency version, check what's actually available/installed rather than recalling a version from memory — package ecosystems move fast and a hallucinated version number breaks the build immediately. Pin exact versions in `requirements.txt` / `package.json` once chosen, and record the choice + rationale in `docs/ARCHITECTURE.md`.

Do not introduce extra frameworks, state-management libraries, or CSS systems beyond this list without asking first. Keep the codebase understandable to a mid-level developer who inherits it after you.

---

## 4. GHANA-SPECIFIC REQUIREMENTS

Build these in as first-class, config-driven concepts — not afterthoughts bolted onto a generic schema:

- **Currency:** Ghana Cedi (GH₵ / GHS), 2 decimal places, stored as integer pesewas or `Decimal` — never float.
- **National ID:** Ghana Card (NIA) number field with format validation (`GHA-XXXXXXXXX-X`), stored separately from any legacy Voter ID / NHIS ID fields.
- **NHIS:** Model an `Insurance` entity generic enough to represent NHIS *and* private insurers. Since there's no public NHIS claims API, build a clean `InsuranceProviderInterface` (or Django app) with a mock/stub implementation now, so a real integration can be swapped in later without touching calling code. **Do not fabricate NHIS API endpoints, response schemas, or claims logic** — mark anything speculative clearly as "mock, pending real integration."
- **Phone numbers:** Ghanaian mobile formats (`+233 XX XXX XXXX`, 10-digit local `0XX XXX XXXX`), validate and normalize to E.164 for storage.
- **Mobile Money:** Model payment method as a configurable enum (Cash, Mobile Money, Bank, Card, Insurance) with Mobile Money sub-typed by provider (MTN MoMo, Telecel Cash, AirtelTigo Money) — again behind a mock payment gateway interface, not a real integration.
- **SMS notifications:** Build against a `NotificationGateway` interface with a console/log-based mock provider (Ghana's SMS aggregator market — Hubtel, Arkesel, etc. — varies by hospital contract; don't hard-code one).
- **Low-bandwidth environments:** Paginate all list endpoints, keep initial JS bundle small, avoid large unoptimized images, design forms to tolerate flaky connections (client-side draft retention, idempotent submit).
- **Localization basics:** Timezone `Africa/Accra` (GMT, no DST) throughout backend and frontend; addresses modeled as free-text region/district/town rather than assuming a rigid Western address schema.
- **Data protection:** Note Ghana's Data Protection Act, 2012 (Act 843) as the relevant compliance framework for handling patient data — audit logging and access controls (Section 8) exist partly to support this. You are not providing legal advice; just design with it in mind.

If you're ever unsure whether something is a real, publicly documented integration point vs. something you'd be inventing, default to building the mock interface and say so explicitly.

---

## 5. USER ROLES & RBAC

Roles: System Administrator, Hospital Administrator, Doctor, Nurse, Receptionist, Laboratory Technician, Pharmacist, Cashier/Accountant, Patient.

- Enforce permissions **only** on the backend; frontend role-based nav/routing is a UX convenience, never the security boundary.
- Use Django's permission framework or a custom `Role` → `Permission` (many-to-many) model — decide which and justify it in `docs/ARCHITECTURE.md` before implementing.
- Principle of least privilege: new roles/permissions default to no access.
- Produce an explicit RBAC matrix (role × module × action: view/create/edit/delete) as a deliverable in Step 8 of the planning phase, and keep it in `docs/`.

---

## 6. CORE MODULES

- **Authentication** — login/logout, password reset flow, JWT session/token management, protected routes, role-based authorization.
- **Patient Management** — registration, generated patient ID, search, profile, demographics, Ghana Card/ID, contacts, emergency contact, insurance, medical history, allergies, visit history, records.
- **Appointments** — create/reschedule/cancel, doctor & department schedules, status tracking, history.
- **Queue Management** — check-in, queue numbers, department/doctor queues, waiting/in-consultation/completed states, priority/emergency handling.
- **Nursing** — vitals (temperature, BP, pulse, respiratory rate, SpO2, weight, height, BMI), nursing notes.
- **Doctor Consultation** — chief complaint, symptoms, clinical notes, diagnosis, differential diagnosis, treatment plan, follow-up, prescription, referral.
- **Laboratory** — test catalogue, requests, sample status, results, result validation, doctor/patient access controls.
- **Pharmacy** — medication catalogue, prescription processing, dispensing (dosage/frequency/duration), stock levels, low-stock alerts, expiry tracking.
- **Inventory** — items, suppliers, stock received/issued/adjusted, expiry dates, batch numbers, stock history.
- **Billing** — invoices & line items (consultation/lab/medication/admission charges), discounts, payments, outstanding balances, receipts. Configurable payment methods (Cash, Mobile Money, Bank, Card, Insurance).
- **Admissions** — wards, rooms, beds, admission, transfer, discharge, bed availability.
- **Referrals** — internal/external, reason, destination, status.
- **Notifications** — SMS/email/in-app via mock gateways (see Section 4).
- **Reports & Analytics** — patient volume, daily visits, appointments, no-shows, department activity, revenue, outstanding payments, lab/pharmacy activity, inventory levels, admissions, bed occupancy. Design the schema/read models to be Power BI-friendly (clean views, consistent naming) without building Power BI integration now.

---

## 7. DATABASE DESIGN

Design a normalized PostgreSQL schema covering (at minimum): User, Role, Permission, Hospital, Department, Patient, Insurance, Appointment, Visit, Queue, VitalSign, Consultation, Diagnosis, MedicalRecord, Prescription, PrescriptionItem, Medication, LaboratoryTest, LaboratoryRequest, LaboratoryResult, InventoryItem, InventoryTransaction, Supplier, Invoice, InvoiceItem, Payment, Ward, Room, Bed, Admission, Discharge, Referral, Notification, AuditLog.

Requirements:
- Decide UUID vs. auto-increment PK **per entity type** with a stated rule (e.g., UUID for anything patient-facing or referenced across services; auto-increment for purely internal lookup tables) and document the rule once rather than deciding ad hoc per table.
- Foreign keys, constraints, indexes, unique constraints, `created_at`/`updated_at` on every table.
- Explicit deletion policy per relationship (soft-delete for clinical/financial records; decide and justify CASCADE vs. PROTECT vs. SET_NULL case by case — never default to CASCADE on records with legal/audit significance).
- Don't create speculative tables for features in Section 12 (Future Features) — only build what current modules need.
- Produce an ER diagram (Mermaid is fine) plus a written explanation of key relationships as part of the planning deliverable.

---

## 8. SECURITY REQUIREMENTS

- Secure password hashing (Django default, Argon2 preferred).
- RBAC enforced server-side, least privilege throughout.
- Input validation, SQL injection protection (ORM, no raw string interpolation), XSS protection, CSRF protection on cookie-based flows, secure headers (`django-secure` / equivalent), rate limiting on auth endpoints.
- Secure JWT handling: short access-token lifetime, refresh rotation, token blacklisting on logout.
- All secrets in `.env`, never in source: no passwords, API keys, DB credentials, or tokens committed.
- **Audit logging** (append-only, no update/delete by normal users) for: login, patient creation/modification, medical record access, diagnosis creation/modification, prescription creation/modification, lab result changes, medication dispensing, invoice creation, payment, user creation, permission changes.
- Controlled/logged data exports.
- Secure, non-leaky error handling (no stack traces or internal details in API responses outside of `DEBUG` mode).

---

## 9. FRONTEND ARCHITECTURE

Clean, modern, responsive, accessible (WCAG AA baseline), fast, and simple enough for non-technical hospital staff — assume variable digital literacy and design forms/flows accordingly (large touch targets, clear error states, minimal jargon).

Planned routes: `/login`, `/dashboard`, `/patients`, `/patients/:id`, `/appointments`, `/queue`, `/consultations`, `/laboratory`, `/pharmacy`, `/inventory`, `/billing`, `/admissions`, `/referrals`, `/reports`, `/users`, `/settings`.

Role-specific navigation: a pharmacist should never even see (not just be blocked from) admin-only modules in the nav — but re-confirm the *backend* still rejects the request regardless of what the UI shows.

---

## 10. PROJECT STRUCTURE

```
hospital-management-system/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
├── backend/
│   ├── manage.py
│   ├── config/
│   ├── apps/
│   │   ├── authentication/
│   │   ├── users/
│   │   ├── patients/
│   │   ├── appointments/
│   │   ├── queues/
│   │   ├── consultations/
│   │   ├── laboratory/
│   │   ├── pharmacy/
│   │   ├── inventory/
│   │   ├── billing/
│   │   ├── admissions/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── audit/
│   └── requirements.txt
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SECURITY.md
│   └── DEVELOPMENT.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── CLAUDE.md
```

Improve this structure if you have a strong architectural reason — state the reason before deviating.

---

## 11. DEVELOPMENT PRINCIPLES

Cycle for every feature: **Analyze → Plan → Implement → Test → Fix → Re-test → Document → Commit.**

- Build incrementally — one module/vertical slice at a time, never the whole app in one pass.
- Before touching files: state current project state, what you intend to build, dependencies, risks, then implement the smallest logical unit.
- Use your task-tracking (todo list) to break each phase into visible steps so I can follow progress across a long session.
- Run tests after every meaningful change; fix failures before moving on.
- Update `docs/` alongside code, not after the fact.
- Use conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`) with one logical change per commit.
- **Never claim a feature is complete unless you've actually run it and it works** — no "this should work" as a substitute for verification.

---

## 12. TESTING

Cover: unit, API, integration, permission, authentication, validation, and business-rule tests.

End-to-end workflow to eventually test: Register patient → Book appointment → Check in → Join queue → Record vitals → Doctor consultation → Diagnosis → Prescription → Pharmacy dispensing → Billing → Payment → Follow-up.

Explicitly test negative/adversarial cases: unauthorized access, IDOR (e.g., patient A viewing patient B's record via ID guessing), invalid patient IDs, duplicate records/invoices, double bed assignment, over-dispensing medication, invalid payment amounts/states, permission escalation attempts.

Use synthetic seed data (a management command or fixture) for local/dev testing — see Section 13.

---

## 13. DATA POLICY

- Synthetic/demo patient data only during development.
- Never commit real patient data, real credentials, or production secrets to Git.
- Add a `.gitignore` covering `.env`, media uploads, and any local DB dumps from day one.

---

## 14. FUTURE FEATURES (NOT NOW — ARCHITECT FOR, DON'T BUILD)

Patient portal, mobile app, real SMS integration, offline-first mode, multi-hospital/multi-branch support, telemedicine, Power BI integration, AI-assisted admin workflows (patient volume/medicine demand forecasting, no-show prediction, wait-time prediction, clinical note summarization).

**Hard constraint:** any AI feature is decision support only. AI must never autonomously diagnose patients or replace a qualified healthcare professional's judgment. Keep this constraint visible in any future AI-related design doc, not just this prompt.

Don't build tables, endpoints, or UI for these now — just avoid architectural decisions that would make adding them later unnecessarily painful (e.g., don't hard-code single-hospital assumptions into the `Patient` model's identity scheme).

---

## 15. FIRST TASK — PLANNING ONLY, DO NOT CODE YET

The repository is empty. Your first job is to plan, not build.

1. Inspect the repository and confirm it's empty (or report what's actually there if it isn't).
2. Produce a complete implementation plan covering the deliverables in Section 16.
3. Design the database schema and relationships (ER diagram + notes).
4. Design the backend API structure (resource list, not full route-by-route spec yet).
5. Design the frontend route structure.
6. Design the RBAC permission matrix (role × module × action).
7. Identify technical risks and open questions — anything you're genuinely unsure about, ask rather than assume.
8. Identify Ghana-specific implementation considerations and flag anywhere you'd otherwise be tempted to fabricate an integration.
9. Propose the project folder structure (Section 10, amended if needed).
10. Draft/update `CLAUDE.md` with the project's development rules and architecture principles, so this context persists across sessions without re-pasting this prompt.
11. Create a phased development roadmap (e.g., Phase 0: scaffolding/auth → Phase 1: patients + appointments → Phase 2: queue + vitals + consultation → Phase 3: lab + pharmacy → Phase 4: billing + admissions → Phase 5: reports).

**Do not start implementing Phase 0/1 code yet.**

---

## 16. REQUIRED INITIAL OUTPUT

After inspecting the repository, present:

1. Repository assessment
2. Confirmed technology stack (with any deviations flagged and justified)
3. System architecture overview
4. Project folder structure
5. Database entities and relationships (with ER diagram)
6. API architecture (resource-level, not full endpoint spec)
7. Frontend routes/screens
8. RBAC matrix
9. Security architecture
10. Ghana-specific considerations, explicitly marking any mocked integration
11. Phased development roadmap
12. Testing strategy
13. Technical risks and open questions for me
14. `CLAUDE.md` proposal (full draft content)
15. Recommended first implementation task, scoped small enough for one focused session

Clearly separate: **what's built now**, **what's built later**, **what's intentionally deferred**.

**Do not write application code yet. Stop after presenting this plan and wait for my explicit approval before starting Phase 0.**

---

## 17. LOCKED PLANNING DECISIONS (from initial planning session, 2026-09-03)

The full planning deliverable (repository assessment, ER diagram, RBAC matrix,
roadmap, open questions) was produced and approved on 2026-09-03. Detail lives
in `docs/`; the decisions below are load-bearing enough to restate here so
they survive even if `docs/` drifts.

**RBAC model** — Custom `Role` (FK on `User`, not M2M) → `Permission` (M2M via
`RolePermission`), layered on Django auth. Enforced only in DRF permission
classes. See `docs/RBAC.md` for the full matrix — treat it as the source of
truth, update it in the same PR as any permission change.

**Primary key rule** — UUID for anything patient-facing, cross-module, or
URL-exposed (doubles as IDOR resistance). Auto-increment only for pure
internal lookup/join tables never used as an external resource id (`Role`,
`Permission`, `RolePermission`, `LaboratoryTest`, `Supplier`, `Ward`, `Room`,
`Bed`, `AuditLog`).

**Deletion policy rule** — Soft-delete clinical/financial records, `PROTECT`
their inbound FKs. Reference tables deactivate (`is_active`) instead of
deleting. `AuditLog` and `InventoryTransaction` are append-only, no delete
path. `RolePermission` is the one table where hard `CASCADE` delete is
acceptable.

**Hospital scoping** — Every hospital-relevant table carries a `hospital_id`
FK from Phase 0, even though only one `Hospital` row exists today and no
hospital-switcher UI is built. Multi-hospital (§14) stays a data problem, not
a schema rewrite, when it's picked up later.

**Staff login identity** — `User.USERNAME_FIELD` is `email`, not a separate
username (`username = None` on the custom model). Staff sign in with the
same email address their account is created with; there is no username
field anywhere to keep in sync. Patients are not `User` rows in Phase 0b —
that's the future patient-portal work in §14.

**Mock integration boundary** — `InsuranceProviderInterface`, `PaymentGateway`,
`NotificationGateway` are the three sanctioned mock seams (see
`docs/ARCHITECTURE.md` / `docs/SECURITY.md` for each interface's contract).
Never call, fabricate, or hard-code a real NHIS/MoMo/SMS-aggregator endpoint —
if it's not one of these three interfaces, it doesn't touch a live provider.

**Open items tracked, not yet resolved** — See `docs/ARCHITECTURE.md` §
"Open questions": patient numbering scheme across future hospitals, whether
System Admin needs a break-glass emergency-access path, clinical note
visibility for Hospital Admin, Medication/InventoryItem split, reporting
access model (DB views vs. API-only), and others. Do not silently resolve one
of these mid-implementation; surface it.

**Phase 0a status: complete.** Repo scaffolding, Docker Compose (Postgres +
backend + frontend), Django+DRF skeleton with a working `/api/v1/health/`
round trip, frontend status page consuming it, docs stubs populated.

**Phase 0b status: complete.** `User`/`Role`/`Permission`/`RolePermission`,
`Hospital`/`Department`, JWT login/refresh/logout with rotation +
blacklist, generic RBAC permission class, append-only `AuditLog` wired into
login/logout, `seed_rbac` demo data, custom exception handler. Login form,
protected routing, and an RBAC-demonstrating dashboard on the frontend. 16
tests passing (10 backend + 6 frontend).

**Phase 1 status: complete.** `Patient` (hospital-scoped `patient_number`
via a counter table), Ghana Card + phone validators in
`apps.core.validators`, `Insurance` + mock `InsuranceProviderInterface`,
`Appointment` (double-booking prevention, cancel-as-status-change, never a
hard delete). RBAC extended to `patients`/`appointments` modules; hospital
isolation enforced at the queryset/serializer level, not just RBAC — a
cross-hospital record 404s rather than 403ing (doesn't confirm existence).
Frontend: patient search/register/detail with insurance, appointment book/
list/cancel, a shared nav shell. 40 tests passing (27 backend + 13
frontend), plus a full live run of the exit criterion (register → add
insurance → verify eligibility → book). `Allergy` deliberately deferred to
Phase 2 (see `docs/DATABASE.md`).

**Phase 2 status: complete.** `Allergy` (carried over from Phase 1);
`Visit`/`Queue`/`QueueNumberSequence` (`apps.queues`, new app);
`VitalSign`/`Consultation`/`Diagnosis`/`MedicalRecord` (`apps.consultations`,
new app); `Appointment` gained a `checked_in` status. RBAC extended to
`queue`/`vitals`/`consultation` modules. Key implementation calls (all
documented in `docs/DATABASE.md`/`docs/RBAC.md`, not silently made): daily
per-department queue numbering; emergency-first ordering; allow-listed Queue
status transitions (no skipping straight to `completed`); one Consultation
per Visit, immutable once completed; at most one primary `Diagnosis` per
consultation; `MedicalRecord` resolved as an append-only snapshot
auto-created on consultation completion (§7 lists it without defining it —
this was the judgment call, not a literal second mutable table) rather than
blocking on a clarifying question, since the alternative (a
separately-editable table) risked drifting from `Consultation`/`Diagnosis`.
48 backend + 19 frontend tests passing (up from 40 + 13), plus a full live
run of the exit criterion (check-in → vitals → consultation start → queue
side-effect confirmed → diagnosis → complete → medical record visible) run
against the actual HTTP API. The frontend itself was verified via its
Vitest/RTL component tests, `tsc -b` type-checking, and a production build —
not a visual browser click-through, since no browser-automation tool was
available this session.

**Phase 3 status: complete.** `LaboratoryTest`/`LaboratoryRequest`/
`LaboratoryResult` (`apps.laboratory`, new app); `Medication`/
`Prescription`/`PrescriptionItem` (`apps.pharmacy`, new app); `Supplier`/
`InventoryItem`/`InventoryTransaction` (`apps.inventory`, new app). RBAC
extended to `laboratory`/`pharmacy`/`inventory` modules. Key implementation
calls (documented in `docs/DATABASE.md`/`docs/RBAC.md`): one test per
`LaboratoryRequest` row rather than a bundle; a real two-step lab result
workflow (Lab Technician records, then a separate validate action) with
the raw value hidden from every other role until validated — CLAUDE.md
§6's "doctor/patient access controls" read as a real visibility gate, not
just an endpoint permission; one `Prescription` per `Consultation`,
mirroring `Diagnosis`; dispensing checked against both the prescription's
remaining quantity and real stock under a row lock (CLAUDE.md §12 names
over-dispensing by name); `InventoryItem.quantity_on_hand` as a maintained
running total that only ever changes through an `InventoryTransaction`,
never written directly. One real RBAC gap was found and fixed, not
assumed away: the matrix grants Lab Technician/Pharmacist `inventory.edit`
but not `.create`, yet they're the ones recording day-to-day stock
movements — resolved by checking `edit` explicitly on that endpoint rather
than `HasModulePermission`'s generic `POST→create` mapping (the same
pattern already used for dispensing's inventory side effect and Phase 2's
queue side effect). 66 backend + 25 frontend tests passing (up from 48 +
19), plus a full live run of the exit criterion against the actual HTTP
API: diagnosis → lab test ordered → sample collected → result entered →
validated → doctor sees it; prescription issued → dispensed against real
seeded stock → stock genuinely decremented → over-dispense past what's
left rejected live. Known gap, flagged not hidden: frontend nav still
isn't role-filtered (CLAUDE.md §9) — every module shows to every
logged-in role; the backend enforces every grant regardless.

**Frontend redesign (between Phase 3 and Phase 4).** At the user's explicit
request, the frontend was rebuilt on Tailwind CSS + a shared component
library (`frontend/src/components/ui/`) with a navy/teal visual identity,
going screen-by-screen (component library → login → app shell → dashboard
→ patients → every remaining module) rather than all at once, per the
user's own rollout order. `App.css` (the original plain-CSS approach) was
deleted once nothing referenced it any more — not left as dead weight.
Every existing page's behavior/tests were preserved exactly; only the
markup and styling changed. See `docs/ARCHITECTURE.md` § Design system for
the full palette/component rationale.

**Phase 4 status: complete.** `Invoice`/`InvoiceItem`/`Payment`
(`apps.billing`, new app); `Ward`/`Room`/`Bed`/`Admission`/`Discharge`
(`apps.admissions`, new app); `Referral` (`apps.referrals`, new app). RBAC
extended to `billing`/`admissions`/`referrals` modules, with one flagged
deviation from the literal matrix: Hospital Admin's `admissions.create`
grant, needed for ward/bed setup even though the matrix gives Hospital
Admin only `V` on admitting a patient (a Doctor/Nurse clinical decision)
— documented in `docs/RBAC.md`, not silently done. Key implementation
calls (documented in `docs/DATABASE.md`): money stored as integer pesewas
throughout, never float (CLAUDE.md §4); `LaboratoryTest`/`InventoryItem`
gained pricing fields deliberately deferred back in Phase 3 for exactly
this moment; invoice generation auto-populates line items from what
actually happened during the visit (consultation fee, completed lab
requests, dispensed prescription items) rather than a blank form,
mirroring Phase 2's `MedicalRecord` auto-generation; `PaymentGateway`
(`apps.billing.gateways`) is the second of the three sanctioned mock
integration seams to actually get built, after `InsuranceProviderInterface`
in Phase 1 — `NotificationGateway` is the one still unbuilt; bed
double-booking is a hard DB constraint
(`unique_active_admission_per_bed`), not just an application-level check
— CLAUDE.md §12's adversarial case by that exact name. 119 passing tests
(89 backend, up from 66; 30 frontend, up from 25), plus a full live run of
the exit criterion against the actual HTTP API: a completed consultation
→ invoice generated with the real consultation fee → a manual line item
added → paid via cash *and* mobile money on the same invoice (proving
"every configured method," not just one) → invoice reaches `paid`; a
patient admitted to a specific bed → a second admission attempt against
that same occupied bed correctly rejected (proving "no double-booking").
See `docs/ROADMAP.md` for what's next (Phase 5: Reports & hardening).

**Billing + Cashier role removed (2026-09-08), explicit user decision.**
The user asked to exclude Billing from the system entirely, and — since
Billing was the Cashier role's only reason to exist (Patients-view plus
Billing was its whole grant set) — to remove the Cashier role too. This
overrides §5's role list (now 8 roles, not 9) and §6/§7/§9's Billing
module/entities/route for this codebase going forward; those sections are
left as the original brief for historical record, not rewritten. Removed
cleanly, not hidden: `apps.billing` (Invoice/InvoiceItem/Payment,
`MockPaymentGateway`, 12 tests) deleted outright after reverse-migrating
its tables locally; `Role.Name.CASHIER` and `Permission.Module.BILLING`
dropped from the enums (migration, not a live-data edit); the
`consultation_fee_pesewas` / `LaboratoryTest.price_pesewas` /
`InventoryItem.unit_price_pesewas` fields — which existed solely to feed
invoice generation — removed with them rather than left as dead columns;
frontend Billing page/route/nav item/service/types and the Billing card
in the Visit workspace all deleted. The pre-existing `cashier@demo.hms.gh`
account was deactivated and detached from its role rather than
hard-deleted, since `AuditLog.actor` is `PROTECT` by design (§8) — its
audit history stays intact, matching the project's own reference-data
"deactivate, don't destroy" rule (§17 "Deletion policy rule"). One
follow-on simplification: `VisitDetailView`'s permission check, recently
broadened to let Cashier reach the Visit workspace via `billing.view`,
was reverted to the plain `queue`-module check — every remaining role
that opens that page already holds `queue.view`, so the broadened check
had no remaining reason to exist. `NotificationGateway` is now the only
one of the three sanctioned mock integrations (§4) still unbuilt;
`PaymentGateway` no longer exists as of this change. `PaymentMethod`/
Mobile Money as Ghana-specific concepts (§4) remain valid architecture —
they were only ever exercised through the now-removed Billing module, not
retired as a concept.

**Patient "Delete" added (2026-09-16), explicit user decision — and made
functional, not just cosmetic.** The user asked for a delete button for one
specific patient at a time (not a bulk wipe — clarified after an initial
mutual misunderstanding). The mechanism was already correctly locked in
as soft-delete (`PATCH is_active`, never a hard `DELETE` — §7, and nearly
the whole clinical graph `PROTECT`s its FK to `Patient`), confirmed via
`AskUserQuestion` before building anything. What was genuinely missing:
a real "Delete"/"Restore" UI on the patient detail page
(`frontend/src/pages/PatientDetail.tsx`, confirmation `Modal`, first real
use of that component outside the design-system showcase) — and, caught
only by checking rather than assuming, the backend's `is_active` flag had
*no actual effect* anywhere: a "deleted" patient still appeared in every
search and could still be checked in or booked. Fixed so the word "delete"
means something: `PatientViewSet.get_queryset()` excludes `is_active=False`
from the default list (`?include_deleted=true` to see them, mirroring the
Ward/Room/Bed reference-data pattern) while still serving a deleted
patient directly by id so the restore flow works; `CheckInSerializer`
and `AppointmentSerializer` both reject a deleted `patient` with a clear
message. Labeled "Delete"/"Restore" in the UI (not "Deactivate"/
"Reactivate") per the user's own wording, with modal copy that says
plainly what actually happens — hidden from search and blocked from new
visits, nothing erased, reversible any time — rather than letting the
friendlier button text imply something it doesn't do. See `docs/RBAC.md`
and `docs/API.md` for the full behavior.