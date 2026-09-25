import { CalendarX2, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  Select,
  SkeletonCard,
  SkeletonTable,
  StatusPill,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Textarea,
  Th,
} from "../components/ui";

const SWATCHES = [
  { name: "navy-900 (primary / sidebar)", className: "bg-navy-900" },
  { name: "navy-800 (panels on navy)", className: "bg-navy-800" },
  { name: "accent-500 (highlight / active)", className: "bg-accent-500" },
  { name: "accent-300 (accent tint)", className: "bg-accent-300" },
  { name: "slate-900 (text)", className: "bg-slate-900" },
  { name: "slate-500 (muted text)", className: "bg-slate-500" },
  { name: "slate-200 (border)", className: "bg-slate-200" },
  { name: "slate-50 (app bg)", className: "bg-slate-50 border border-slate-200" },
  { name: "emerald-600 (success)", className: "bg-emerald-600" },
  { name: "amber-500 (warning)", className: "bg-amber-500" },
  { name: "red-600 (danger)", className: "bg-red-600" },
];

const DEMO_STATUSES = [
  "completed",
  "pending",
  "waiting",
  "cancelled",
  "in_progress",
  "urgent",
  "dispensed",
  "low_stock",
  "sample_collected",
  "scheduled",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

export function DesignSystem() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
          Ghana HMS — Internal
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-900">Design system</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Stage 1 of the redesign — the shared component library every page will be rebuilt on
          top of, so the app reads as one product instead of patched-together screens.
        </p>
      </header>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SWATCHES.map((s) => (
            <div key={s.name} className="flex flex-col gap-2">
              <div className={`h-14 rounded-xl ${s.className}`} />
              <span className="text-xs text-slate-500">{s.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-2xl font-semibold text-navy-900">Page title — 24px semibold</p>
          <p className="text-lg font-semibold text-navy-900">Section header — 18px semibold</p>
          <p className="text-sm text-slate-700">
            Body text — 15px regular. Used for everything a hospital staff member reads in a
            form, a table row, or a note.
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Label / caption — 12px medium, muted
          </p>
          <p className="text-sm tabular-nums text-slate-700">
            Tabular figures for numbers: GH₵ 1,204.50 · 08:45 AM · Queue #12
          </p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="accent" leftIcon={<Plus className="h-4 w-4" />}>
              New patient
            </Button>
            <Button variant="secondary" leftIcon={<Search className="h-4 w-4" />}>
              Search
            </Button>
            <Button variant="destructive" leftIcon={<Trash2 className="h-4 w-4" />}>
              Cancel visit
            </Button>
            <Button disabled>Disabled</Button>
            <Button
              isLoading={loadingDemo}
              onClick={() => {
                setLoadingDemo(true);
                setTimeout(() => setLoadingDemo(false), 1500);
              }}
            >
              {loadingDemo ? "Signing in…" : "Click to preview loading"}
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Badges / status pills">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {DEMO_STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
          <Badge tone="info">Custom label</Badge>
        </div>
      </Section>

      <Section title="Cards">
        <Card className="max-w-md">
          <CardHeader>
            <div>
              <CardTitle>Ama Mensah</CardTitle>
              <CardDescription>PAT-000042 · Registered 2026-08-11</CardDescription>
            </div>
            <StatusPill status="active" />
          </CardHeader>
          <CardBody className="text-sm text-slate-600">
            Card body content goes here — profile details, a form, a summary. Consistent
            16–24px padding, one shared border-radius, a subtle shadow instead of a heavy
            border.
          </CardBody>
          <CardFooter>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
            <Button size="sm">Save</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Table">
        <Table>
          <TableHead>
            <TableRow>
              <Th>Patient</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th className="text-right">Amount</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              ["Ama Mensah", "General Outpatient", "waiting", "GH₵ 45.00"],
              ["Kofi Asante", "Maternity", "in_progress", "GH₵ 120.00"],
              ["Kwesi Boateng", "General Outpatient", "completed", "GH₵ 80.50"],
            ].map(([name, dept, status, amount]) => (
              <TableRow key={name}>
                <Td className="font-medium text-slate-900">{name}</Td>
                <Td>{dept}</Td>
                <Td>
                  <StatusPill status={status} />
                </Td>
                <Td className="text-right tabular-nums">{amount}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-xl gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Input label="Full name" placeholder="Ama Mensah" required />
          <Input
            label="Phone"
            placeholder="024 123 4567"
            error="Enter a valid Ghanaian phone number."
          />
          <Select label="Department" defaultValue="">
            <option value="" disabled>
              Choose a department…
            </option>
            <option value="opd">General Outpatient</option>
            <option value="maternity">Maternity</option>
          </Select>
          <Textarea label="Notes" hint="Optional — visible to the care team only." rows={3} />
        </div>
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Avatar name="Ama Mensah" size="sm" />
          <Avatar name="Kofi Asante" size="md" />
          <Avatar name="Dr. Kwesi Owusu" size="lg" />
        </div>
      </Section>

      <Section title="Modal">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Cancel appointment?"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Keep appointment
                </Button>
                <Button variant="destructive" onClick={() => setModalOpen(false)}>
                  Cancel it
                </Button>
              </>
            }
          >
            <p className="text-sm text-slate-600">
              This will mark the appointment as cancelled. The patient will need to be
              rebooked.
            </p>
          </Modal>
        </div>
      </Section>

      <Section title="Empty states">
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            icon={CalendarX2}
            title="No appointments today"
            description="Once a patient books, it'll show up here."
            action={
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                Book appointment
              </Button>
            }
          />
          <EmptyState
            icon={UserRound}
            title="No patients found"
            description="Try a different name, phone number, or Ghana Card number."
          />
        </div>
      </Section>

      <Section title="Skeletons (loading states)">
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonTable rows={4} columns={3} />
        </div>
      </Section>
    </div>
  );
}
