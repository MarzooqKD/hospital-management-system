# RBAC matrix

Source of truth for role permissions. Update this file in the same PR as any
permission change — the `Role`/`Permission` seed data should match this
table exactly.

**Enforced today:** "Users & Roles", "Audit Log", "Patient
Records", "Appointments", "Queue", "Vitals", "Consultation", "Laboratory",
"Pharmacy", "Inventory", "Admissions", and "Referrals" —
`apps.core.permissions.HasModulePermission` checks a user's `Role` against
`Permission`/`RolePermission`, seeded by `python manage.py seed_rbac`.
Every other row is the target for its module once that module ships; the
mechanism is generic and reused as-is — new rows just need `Permission`
rows seeded and `required_module` set on the view. ("Billing" and the
`Cashier` role/column existed through Phase 4 and were deliberately
removed on 2026-09-08 — CLAUDE.md §17.)

**Patient Records has no `D` cell for any role** (Hospital Admin/Receptionist
hold `E` only) — this is deliberate, not a gap: a patient is never hard-deleted
(CLAUDE.md §7's soft-delete rule, plus nearly the entire clinical graph hangs
off `Patient` via `PROTECT` FKs). The frontend's "Delete"/"Restore" action on
the patient detail page is `patients.edit`'s `is_active` toggle, not a
separate delete permission — same pattern as Allergy's deactivation below,
just user-facing as "delete" since that's the more honest word for what
staff are actually trying to do (CLAUDE.md §17, 2026-09-16). A deleted
patient is excluded from the default `GET /patients/` list and rejected by
both check-in and appointment booking until restored — see `docs/API.md`.

The Patient role's `V·own` on every clinical module is **not** enforced —
there is no link from `User` to a `Patient` row yet (the patient portal is
future work, CLAUDE.md §14), so the `patient` role is granted nothing on
any module rather than a blanket view that would leak every patient's
record.

Footnote ³ (Hospital Admin's `V` on Consultation — full clinical notes vs.
metadata-only) is implemented as the matrix literally shows: full `view`.
Building a redacted/metadata-only serializer variant for Hospital Admin
specifically was judged out of scope for Phase 2 — the footnote stays open
as a real question, not silently resolved by the current implementation.

RBAC design notes from building Phases 2 and 3, not literal matrix rows:
- **Allergy rides under "Patient Records"**, not its own module (same
  precedent as Insurance in Phase 1) — so Nurse (`V·C`, no edit) can record
  an allergy but not deactivate one; only Reception/Hospital Admin (`V·C·E`)
  can. See `docs/DATABASE.md`'s Allergy note.
- **Starting a Consultation moves the linked Queue entry to
  `in_consultation`** as a side effect of the doctor's `consultation.create`
  action — a Doctor is not separately granted `queue.edit` to do this,
  matching the matrix (Doctor: `V` only on Queue) exactly.
- **Dispensing moves real stock** as a side effect of the Pharmacist's
  `pharmacy.create` action (they already hold it) — not a separate
  `inventory` grant check, same pattern as the Queue side effect above.
- **Recording an inventory transaction (received/issued/adjusted) checks
  `inventory.edit`, not the generic `create` mapping** — the matrix gives
  Lab Technician/Pharmacist `V·E` on Inventory (no `create`; only Hospital
  Admin can add a brand-new catalogue entry), but they're the ones who
  actually move stock day to day. `HasModulePermission`'s method→action
  mapping is fixed (`POST→create`), so the transaction-recording endpoint
  bypasses it and checks `inventory.edit` directly — see
  `docs/DATABASE.md`'s InventoryTransaction note. This is the second
  intentional deviation from the shared mechanism after the Queue side
  effect above; both are documented here rather than silently baked in.
- **Footnote ⁴ (is Inventory access scoped by department/category, or one
  flat module shared by Lab Tech and Pharmacist?) is implemented as the
  matrix literally shows: one flat module.** A pharmacist can currently see
  and adjust non-medication consumable stock too, and vice versa for a lab
  technician. Left open, not silently resolved — revisit if that turns out
  to matter in practice.

RBAC design notes from building Phase 4:
- **Hospital Admin's `admissions.create` is a deliberate extension beyond
  the literal matrix**, which gives Hospital Admin only `V` on Admissions
  (admitting a patient is a Doctor/Nurse clinical decision, per the
  matrix's own `Doctor: VC` / `Nurse: VC` row). But ward/room/bed *setup*
  — creating the wards and beds a hospital actually has — is a
  hospital-configuration task with no other role positioned to do it, so
  Hospital Admin was granted `create` on the same module for that purpose.
  Flagged here, not silently done: a Hospital Admin can also directly admit
  a patient through this same grant, which the literal matrix didn't
  intend — acceptable for now since nothing stops a Hospital Admin from
  overseeing clinical operations, but worth splitting into a separate
  "ward management" permission if that distinction ever matters.
- **`GET /visits/<id>/` (the shared header info the whole frontend Visit
  Workspace loads first) briefly needed a bespoke `CanViewVisit` permission
  (grant if the user held `view` on any of `queue`/`vitals`/`consultation`/
  `billing`/`admissions`/`referrals`), because Cashier held `billing.view`
  but no `queue.view` at all — its own grant was otherwise unreachable
  through the UI. That whole class of problem went away when Billing/
  Cashier were removed (2026-09-08): every remaining role that opens the
  page already holds `queue.view`, so `VisitDetailView` is back to the
  plain `required_module = "queue"` check — the bespoke permission class
  was deleted along with it rather than left in place unused.
- **Vitals and Consultation not loading independently on the Visit
  Workspace used to fail the whole page for a role denied either one** —
  found while chasing the Cashier/Billing issue above, but not specific to
  it: Receptionist holds neither `vitals.view` nor `consultation.view`
  either. Fixed by fetching each independently and hiding just that card
  on a 403 rather than failing the page (`frontend/src/pages/
  VisitWorkspace.tsx`) — this fix stayed even after Billing/Cashier were
  removed, since it's still true for Receptionist.
- **Referrals is rendered unconditionally on the Visit Workspace, not
  gated on `{consultation && ...}`** — it was originally copied from the
  Laboratory/Prescription cards, which genuinely need `consultation.id`
  to make their API calls; Referrals doesn't (`Referral` is FK'd to
  `Visit`, not `Consultation`). Receptionist holds `referrals.view` but no
  `consultation.view`, so gating it that way meant Receptionist could
  never see the card at all. Kept after the Billing/Cashier removal for
  the same reason — this one wasn't billing-specific.

Legend: `V` view · `C` create · `E` edit · `D` delete/deactivate ·
`·own` scoped to the user's own record only · `—` no access, module hidden
from nav. Enforcement is server-side only (CLAUDE.md §9); nav visibility is a
UX convenience — implemented by having `GET /users/me/` serialize
`User.permitted_modules()` (the same grants `HasModulePermission` checks) and
having the frontend's `AppLayout`/`RequireModule` filter/gate on it, so a
role's nav and direct-URL access track this table without a second
hand-copied source of truth. See `docs/SECURITY.md`'s note on the frontend
redesign entry for detail. A module cell with no `V` means that role can
act on the module through another screen (typically the Visit workspace)
but won't see its own worklist page in nav — that's intentional, not a bug.

First draft from planning (2026-09-03) — footnoted cells are open questions,
see `docs/ARCHITECTURE.md` § Open questions. The `Cashier` role and
`Billing` module/row were part of this draft through Phase 4 and were
removed on 2026-09-08 per explicit user decision — see CLAUDE.md §17 and
`docs/ROADMAP.md`. Not shown below.

| Module | Sys Admin | Hosp. Admin | Doctor | Nurse | Reception | Lab Tech | Pharmacist | Patient |
|---|---|---|---|---|---|---|---|---|
| Users & Roles | VCED | VCE¹ | — | — | — | — | — | — |
| Patient Records | — | VE | VC² | VC | VCE | V | V | V·own |
| Appointments | — | V | VCE | V | VCED | — | — | V·own |
| Queue | — | V | V | VCE | VCE | V | V | — |
| Vitals | — | V | V | VCE | — | — | — | V·own |
| Consultation | — | V³ | VCE | V | — | — | V | V·own |
| Laboratory | — | V | VC | VC | — | VCE | — | V·own |
| Pharmacy | — | V | VC | V | — | — | VCE | V·own |
| Inventory | — | VCE | — | V | — | VE⁴ | VE⁴ | — |
| Admissions | — | V | VC | VC | V | — | — | V·own |
| Referrals | — | V | VCE | V | V | — | — | V·own |
| Notifications | V | V | — | C | VC | — | — | V·own |
| Reports | V·sys | VCE | — | — | — | V·scope | V·scope | — |
| Audit Log | V | V·own hosp. | — | — | — | — | — | — |

¹ own hospital only, cannot delete a System Admin account.
² Doctor create-access covers walk-in/emergency registration only — routine
registration is Reception's job.
³ open question: should Hospital Admin read full clinical notes for
oversight, or metadata only?
⁴ open question: is inventory access scoped by department/category, or one
flat module shared by Lab Tech and Pharmacist?
