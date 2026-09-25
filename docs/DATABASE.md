# Database design

Status: Phase 0 (`Hospital`, `Department`, `User`, `Role`, `Permission`,
`RolePermission`, `AuditLog`), Phase 1 (`Patient`, `Insurance`,
`Appointment`), Phase 2 (`Allergy`, `Visit`, `Queue`, `VitalSign`,
`Consultation`, `Diagnosis`, `MedicalRecord`), Phase 3
(`LaboratoryTest`, `LaboratoryRequest`, `LaboratoryResult`, `Medication`,
`Prescription`, `PrescriptionItem`, `Supplier`, `InventoryItem`,
`InventoryTransaction`), and Phase 4 (`Ward`, `Room`, `Bed`, `Admission`,
`Discharge`, `Referral`) are implemented and migrated. `Invoice`,
`InvoiceItem`, and `Payment` were also built in Phase 4 and removed
entirely on 2026-09-08 per explicit user decision, along with the
Cashier role — see CLAUDE.md §17. The rest are designed but not yet
built — see `docs/ROADMAP.md`.

For primary-key and deletion-policy rules, see `docs/ARCHITECTURE.md`.

## Entities

Identity & access: `Hospital`, `Department`, `Role`, `Permission`,
`RolePermission`, `User` — **implemented**.

Patient domain: `Patient`, `Insurance`, `Allergy` — **implemented**.

Scheduling: `Appointment`, `Visit`, `Queue` — **implemented**.

Clinical: `VitalSign`, `Consultation`, `Diagnosis`, `MedicalRecord`,
`Prescription`, `PrescriptionItem`, `Medication` — **implemented**.

Laboratory: `LaboratoryTest`, `LaboratoryRequest`, `LaboratoryResult` —
**implemented**.

Inventory & pharmacy stock: `InventoryItem`, `Supplier`,
`InventoryTransaction` — **implemented**.

Billing: `Invoice`, `InvoiceItem`, `Payment` — **removed** (built in Phase 4,
deleted 2026-09-08 per explicit user decision — CLAUDE.md §17).

Admissions: `Ward`, `Room`, `Bed`, `Admission`, `Discharge` — **implemented**.

Other: `Referral` — **implemented**. `Notification` — Phase 4/5 (not yet
slotted into a specific phase's roadmap line — see `docs/ROADMAP.md`).
`AuditLog` — **implemented**.

## Key relationships

- **Appointment vs. Visit** are deliberately separate: `Appointment` is the
  booking, `Visit` is the actual encounter (not yet built — Phase 2). A
  walk-in with no prior booking will still get a `Visit`, and everything
  clinical hangs off `Visit`, not `Appointment`.
- **Patient.patient_number** is unique **per hospital**, not globally —
  generated via `PatientNumberSequence`, a one-row-per-hospital counter
  incremented under `select_for_update()` so concurrent registrations at the
  same hospital never collide. Format: `PAT-000001`. This was an open
  question at planning time (global vs. per-hospital); per-hospital was
  chosen as the more reversible default given only one hospital exists
  today — revisit before multi-hospital ships (CLAUDE.md §14).
- **Insurance → Patient** is generic enough for NHIS and private insurers
  (`provider_type`); a patient can hold more than one (e.g. NHIS plus a
  private top-up). `PROTECT` on delete, per the clinical-record deletion
  policy.
- **Appointment → Patient/Department** are hospital-scoped and cross-checked
  server-side: booking a patient or department from a different hospital
  than the requesting staff member's is rejected, not just filtered out of
  dropdowns. `Appointment.doctor` is nullable — a booking can be
  department-only, with a specific doctor assigned later (there's no
  "browse doctors" endpoint yet; Reception isn't granted `users.view`).
- **Cancelling an appointment never deletes the row** — `DELETE` sets
  `status=cancelled` instead, since cancellation/no-show history is
  reporting-relevant (CLAUDE.md §6).
- **Medication vs. InventoryItem** are split: `Medication` (in the `pharmacy`
  app) is the clinical catalogue; `InventoryItem` (in the `inventory` app) is
  generic stock tracking shared with non-medication supplies, linked to
  `Medication` by a nullable FK (null for non-medication supplies —
  consumables, equipment). A `UniqueConstraint` enforces at most one
  `InventoryItem` per `(hospital, medication)` pair, so "the stock record
  for Paracetamol at this hospital" is always unambiguous — dispensing
  looks it up by that pair, not by picking among several.
- **Bed** carries a partial-unique constraint (one active `Admission` per
  bed, `condition=Q(status="admitted")`) to prevent double-booking —
  required by CLAUDE.md §12's adversarial test list.
- **Allergy** is structured, not free-text (`allergen`/`reaction`/`severity`
  fields), per the flag raised during planning, so pharmacy dispensing can
  safety-check against it once Phase 3 lands. Never hard-deleted — a
  wrongly-recorded entry is deactivated (`is_active=False`), same pattern as
  `Patient.is_active`. It rides under the existing "patients" RBAC module
  rather than getting its own, so a Nurse (who has `patients` view+create
  but not edit — docs/RBAC.md) can record one but not deactivate it; only
  Reception/Hospital Admin can. That's a real granularity gap worth
  revisiting if clinical staff end up needing to correct their own entries.
- **Visit vs. Queue**: `Visit` is the encounter (patient/department/
  appointment/status); `Queue` is the one-per-visit workflow-tracking row
  (queue number, priority, waiting/in_consultation/completed/cancelled).
  Kept separate per CLAUDE.md §7's entity list rather than merged, even
  though today they're always created together at check-in
  (`CheckInSerializer.create()`), because `Visit` is what clinical records
  hang off (`VitalSign.visit`, `Consultation.visit`) while `Queue` is purely
  operational — a future e.g. re-queue-to-a-different-department scenario
  shouldn't need to touch clinical records.
- **Queue numbering resets daily per (hospital, department)** — a
  `QueueNumberSequence` row per day, incremented under `select_for_update()`
  (same locking pattern as `PatientNumberSequence`). Matches how Ghanaian
  clinics actually announce queue position ("number 12 today"), not a
  number that climbs forever.
- **Appointment gained a `checked_in` status** in Phase 2 — deliberately
  withheld in Phase 1 until `Queue` existed to set it. Check-in with a
  linked `Appointment` moves it to `checked_in`; completing the resulting
  Consultation moves it to `completed`. An `Appointment` cancelled or
  already checked in cannot be checked in again (`CheckInSerializer`).
- **One active Visit per patient at a time** — `CheckInSerializer` rejects a
  second check-in while an earlier `Visit` is still `active`, so a patient
  can't be in two queues simultaneously.
- **Consultation is one-per-Visit** (`OneToOneField`) for Phase 2 — a
  follow-up encounter gets its own new `Visit` via a fresh check-in, not a
  second `Consultation` on the same one. Immutable once
  `status=completed` (enforced in the view, not a DB constraint): no
  further `PATCH`, and no further `Diagnosis` can be added.
- **Only one primary `Diagnosis` per `Consultation`** — enforced in
  `DiagnosisSerializer.validate()`; additional diagnoses must be
  `differential`. Completing a `Consultation` requires at least one
  diagnosis to exist at all.
- **`MedicalRecord` is a resolved open question**, not a literal reading of
  CLAUDE.md §7 (which lists it without defining it). Rather than a second,
  independently-editable clinical table that could drift from
  `Consultation`/`Diagnosis`, it's an **append-only snapshot**
  auto-created when a `Consultation` is completed
  (`ConsultationCompleteView`) — no create/update/delete endpoint exists for
  it at all, same treatment as `AuditLog`/`InventoryTransaction`. It exists
  so "patient medical history" and future Reports (Phase 5) have one stable,
  denormalized row per visit to query instead of re-deriving from mutable
  working data. Completing a `Consultation` also closes its `Visit`
  (`status=closed`), completes the linked `Queue` entry, and completes the
  linked `Appointment` if one exists — one transaction, so none of those can
  drift out of sync with each other.

- **LaboratoryTest is not hospital-scoped** — it's a shared, national-style
  catalogue (auto-increment PK, per the lookup-table PK rule), not owned per
  hospital, unlike `Department`/`Medication`/`InventoryItem`. A
  `LaboratoryRequest` is one test per row, not a bundle — ordering "FBC +
  Malaria RDT" creates two requests, avoiding a `LaboratoryRequestItem` join
  table beyond CLAUDE.md §7's minimum list.
- **Lab result validation is a real two-step workflow**, not a rubber stamp:
  a Lab Technician's `POST .../result/` only succeeds once
  `LaboratoryRequest.status=sample_collected`, and the request only reaches
  `completed` via a separate `.../result/validate/` action. Until validated,
  `LaboratoryResultSerializer.to_representation()` hides `result_value`/
  `is_abnormal` from everyone except a Lab Technician — CLAUDE.md §6's
  "doctor/patient access controls" bullet, read as "don't show a draft
  result as though it were final," not just "gate the endpoint."
- **Prescription is one-per-Consultation** (`OneToOneField`), mirroring
  `Diagnosis`'s per-visit scope — a follow-up gets its own new `Visit` and
  `Consultation`, not a second `Prescription` on the same one.
  `PrescriptionItem`s are addable only while the consultation is
  `in_progress`, same rule as `Diagnosis`.
- **Dispensing checks two independent ceilings**: it can't exceed what's
  left on the prescription (`quantity_prescribed - quantity_dispensed`,
  `DispenseSerializer`) *and* it can't exceed real stock
  (`InventoryItem.quantity_on_hand`, checked under `select_for_update()` in
  the view) — CLAUDE.md §12 names over-dispensing explicitly as an
  adversarial case to guard against. A successful dispense writes one
  `InventoryTransaction` (type `issued`, linked back to the
  `PrescriptionItem` via `dispensed_prescription_item`) and decrements
  `InventoryItem.quantity_on_hand` in the same transaction — they can never
  drift apart.
- **`InventoryItem.quantity_on_hand` is a maintained running total, never
  written directly** — the only way it changes is through an
  `InventoryTransaction`, created either by receiving/issuing/adjusting
  stock directly or as a side effect of dispensing. This is the same
  ledger-plus-materialized-total pattern as `PatientNumberSequence`/
  `QueueNumberSequence`, just on the aggregate row itself rather than a
  separate counter table, since `InventoryItem` already *is* the aggregate.
- **`InventoryTransaction` is auto-increment PK and append-only** — no
  update/delete path anywhere, same treatment as `AuditLog`
  (docs/ARCHITECTURE.md's deletion-policy rule already named the two
  together before either was built; this extends that same reasoning to
  the primary-key choice). Batch number and expiry date are recorded
  per-transaction, not on `InventoryItem` itself — a proper FEFO-aware
  `StockBatch` entity tracking remaining quantity per batch would be the
  more "correct" model, but isn't in CLAUDE.md §7's minimum entity list.
  This is a known, deliberate simplification: revisit if expiry-driven
  stock rotation becomes a real requirement.
- **Recording a stock movement is RBAC-modeled as an `inventory` *edit*
  action, not `create`** — docs/RBAC.md grants Lab Technician/Pharmacist
  `inventory.edit` but not `inventory.create` (only Hospital Admin can add
  a brand-new catalogue entry). Since `HasModulePermission`'s method→action
  mapping is a fixed `POST→create`, the transaction-recording endpoint
  checks `inventory.edit` explicitly rather than relying on that generic
  mapping — see `InventoryTransactionListCreateView`.

- **Billing (`Invoice`/`InvoiceItem`/`Payment`, `apps.billing`) was built in
  Phase 4 and removed entirely on 2026-09-08**, per explicit user decision
  — see CLAUDE.md §17 for the full reasoning and what was involved
  (app deletion, RBAC enum changes, the now-unused pricing fields
  `Hospital.consultation_fee_pesewas`/`LaboratoryTest.price_pesewas`/
  `InventoryItem.unit_price_pesewas` removed too rather than left as dead
  columns). Its design notes — money as integer pesewas never float,
  auto-populating an invoice from real visit activity, maintained running
  totals, void-not-delete, payment-amount validation, the mock
  `PaymentGateway` — are no longer reflected here since the tables and
  code are gone; if billing is ever rebuilt, `docs/ROADMAP.md`'s Phase 4
  entry still describes the approach that worked.
- **`Admission` is one-per-Visit** (`OneToOneField`) — a readmission is a
  fresh check-in and a fresh `Visit`, not a second `Admission` on the same
  one. `unique_active_admission_per_bed` (`condition=Q(status="admitted")`)
  is the double-booking guard the Phase 3-era note above already named as
  a known future requirement, now actually built and adversarially tested.
- **Transfer has no dedicated model** — it's a `PATCH`-style action
  (`TransferView`) that changes `Admission.bed` after re-validating the
  new bed isn't occupied, logged via `AuditLog` as `admission_transferred`.
  A full bed-history table isn't in CLAUDE.md §7's minimum entity list;
  the audit log is the historical trace.
- **`Discharge` is a separate model from `Admission`**, not just a status
  flag, mirroring `Consultation`/`Diagnosis` and `Consultation`/
  `MedicalRecord` — CLAUDE.md §7 lists Admission and Discharge as distinct
  entities, and a discharge carries its own content (summary, follow-up
  instructions) worth keeping as a discrete record rather than bloating
  `Admission` with fields that are blank for every still-admitted patient.
- **Hospital Admin's `admissions.create` grant is a deliberate, flagged
  extension beyond the literal RBAC matrix** (which gives Hospital Admin
  only `V` on Admissions) — see `docs/RBAC.md`'s note on why ward/room/bed
  *setup* needed it even though *admitting a patient* is a Doctor/Nurse
  clinical decision per the matrix.
- **`Referral` links to a `Visit`, not just a `Patient`** — consistent with
  `Admission`, so a referral is always traceable to the specific
  encounter that prompted it, not floating free of clinical context.

## ER diagram

The full Mermaid ER diagram with attributes is in the planning artifact
published during the initial planning session. It will be inlined here once
all the entities it covers exist, so this file never claims a table exists
before its migration does.
