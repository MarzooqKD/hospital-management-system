# Roadmap

Checked off as each exit criterion is actually run and verified, not when
code merely looks complete (CLAUDE.md §11).

- [x] **Phase 0a — Scaffolding.** Repo init, Docker Compose config (Postgres +
      backend + frontend), Django+DRF skeleton, `core` app, health-check
      round trip. **Exit:** frontend shows a live response from the backend,
      backend confirms real database connectivity — verified natively
      (Django + Vite dev servers against a local Postgres); `docker compose
      up` itself is unverified on this dev machine (macOS 12, unsupported by
      both Colima/qemu and Docker Desktop) — see `docs/ARCHITECTURE.md` §
      Status.
- [x] **Phase 0b — Auth.** `User`/`Role`/`Permission` models, JWT
      login/logout, audit log skeleton. **Exit:** a user logs in through the
      real UI and hits a protected API route; the RBAC deny path returns
      403 — verified via the actual login form + dashboard (`GET /users/`
      as Receptionist → visible 403 message; as System Admin → full list),
      plus 10 passing backend tests covering login success/failure audit
      rows, permission grant/deny, and token blacklist-on-logout.
- [x] **Phase 1 — Patients + Appointments.** Patient CRUD/search, Ghana Card
      + phone validation, `Insurance` + mock provider, Department seed data,
      Appointment booking. **Exit:** Reception registers a patient and
      books an appointment end-to-end — verified live via the real
      registration form → patient detail → book-appointment flow (also
      added: NHIS mock eligibility check, appointment cancellation as a
      status change, double-booking and hospital-isolation checks). 40
      passing tests (27 backend + 13 frontend). `Allergy` deliberately not
      built — deferred to Phase 2, see `docs/DATABASE.md`.
- [x] **Phase 2 — Queue, Vitals, Consultation.** Check-in → Queue,
      `VitalSign` entry, Consultation workspace, Diagnosis, `MedicalRecord`.
      Also: `Allergy` (deferred from Phase 1), `Appointment.checked_in`
      status. **Exit:** a patient is checked in, queued, and consulted with
      notes saved — verified live via the real API chain (check-in → nurse
      records vitals → doctor starts consultation → queue entry flips to
      in_consultation → diagnosis added → consultation completed →
      medical record appears on the patient's history), plus a CORS
      preflight check on the new endpoints. 48 backend + 19 frontend tests
      passing (up from 40 + 13). `MedicalRecord`'s shape was an open
      question in CLAUDE.md §7 (listed, not defined) — resolved as an
      append-only per-visit snapshot auto-created on consultation
      completion, not a separately-editable table; see `docs/DATABASE.md`.
- [x] **Phase 3 — Lab + Pharmacy.** `LaboratoryTest`/Request/Result,
      Medication catalogue, Prescription + items, Inventory + dispensing.
      **Exit:** a diagnosis triggers a lab request and a prescription
      dispensable against real stock — verified live via the real API
      chain (diagnosis added → lab test ordered → sample collected →
      result entered → validated → doctor can see it; prescription issued
      → dispensed against seeded stock → stock genuinely decremented →
      re-dispensing past what's left correctly rejected). 91 passing tests
      (66 backend, up from 48; 25 frontend, up from 19). A real
      RBAC/permission-mapping problem was found and fixed by actually
      building this, not assumed away: Lab Technician/Pharmacist hold
      `inventory.edit` but not `.create` per the matrix, yet need to
      record day-to-day stock movements — resolved by checking `edit`
      explicitly on that one endpoint rather than the generic
      method-based mapping (see `docs/RBAC.md`).
- [x] **Phase 4 — Billing + Admissions.** Invoice/Payment, Mobile Money mock
      gateway, Ward/Room/Bed, Admission/Discharge, Referrals. **Exit:** a
      visit produces an invoice payable through every configured method, and
      a patient is admitted to a specific bed with no double-booking —
      verified live via the real API chain (consultation completed →
      invoice generated with the real consultation fee → manual item added
      → paid via cash *and* mobile money on the same invoice → invoice
      reaches `paid`; a patient admitted to a specific bed → a second
      admission attempt against the same occupied bed rejected). 119
      passing tests (89 backend, up from 66; 30 frontend, up from 25).
      Between Phase 3 and this phase, the frontend was also fully
      redesigned (Tailwind CSS + a shared component library, navy/teal
      palette) at the user's explicit request — every existing page was
      rebuilt on the new system before Phase 4's new pages (Billing/
      Admissions/Referrals) were built directly on it from the start. See
      `docs/ARCHITECTURE.md` § Design system.
- [x] **Billing + Cashier role removed (2026-09-08).** Explicit user
      decision, not a bug fix — see CLAUDE.md §17 for the full reasoning.
      `apps.billing` deleted outright (reverse-migrated locally first, so
      its tables are actually gone, not just unmanaged); `Role.Name.CASHIER`
      and `Permission.Module.BILLING` dropped via migration; the
      billing-only pricing fields (`Hospital.consultation_fee_pesewas`,
      `LaboratoryTest.price_pesewas`, `InventoryItem.unit_price_pesewas`)
      removed with it; frontend Billing page/route/nav/service/types and
      the Billing card in the Visit workspace deleted. **Exit:** `/invoices/`
      404s, the demo Cashier account can no longer authenticate (deactivated,
      audit history preserved per `AuditLog.actor`'s `PROTECT`), and no
      remaining role's grants reference `billing` — verified live against
      the real API, plus 79 backend tests (down from 93, the 14 removed were
      billing/Cashier-specific) and 35 frontend tests (down from 37) passing,
      `manage.py check` clean, `tsc -b` clean, production build clean.
- [ ] **Phase 5 — Reports & hardening.** Reporting read models
      (Power-BI-friendly views), full Playwright run of the end-to-end
      workflow, rate limiting/security headers, accessibility audit,
      adversarial/IDOR test suite. **Exit:** the full patient journey passes
      E2E, and every negative/adversarial case in CLAUDE.md §12 has an
      automated test.
