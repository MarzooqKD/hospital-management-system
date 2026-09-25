import axios from "axios";
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  ListOrdered,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Skeleton,
  StatusPill,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getBedOccupancySummary } from "../services/admissions";
import { fetchAllUsers } from "../services/auth";
import { listAppointments } from "../services/appointments";
import { listInventoryItems } from "../services/inventory";
import { listPatients } from "../services/patients";
import { listQueue } from "../services/queue";
import type { Appointment } from "../types/appointment";
import type { CurrentUser } from "../types/auth";

type UsersRequestState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ok"; users: CurrentUser[] }
  | { phase: "forbidden" }
  | { phase: "error"; message: string };

/** null = still loading, "forbidden" = the signed-in role can't see this
 * stat (a real RBAC outcome, not an error to hide), number/string = the real
 * value. Nothing here is a placeholder — each card is backed by a live
 * endpoint, and simply isn't rendered if the role has no access to it. */
type StatValue = number | string | "forbidden" | null;

type BedsSummary = { total: number; occupied: number } | "forbidden" | null;

type Tone = "blue" | "emerald" | "amber" | "purple" | "red";

const TONE_CLASSES: Record<Tone, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  purple: "bg-purple-500/10 text-purple-600",
  red: "bg-red-500/10 text-red-600",
};

function humanize(slug: string): string {
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Africa/Accra throughout, per CLAUDE.md §4 — never the browser's local zone. */
function accraHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Accra" }).format(
      new Date(),
    ),
  );
}

function accraDateLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Accra",
  }).format(new Date());
}

function accraTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Accra",
  }).format(new Date(iso));
}

function greeting(): string {
  const hour = accraHour();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  to,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: StatValue;
  caption?: string;
  to: string;
  tone: Tone;
}) {
  if (value === "forbidden") return null;

  return (
    <Link to={to}>
      <Card className="transition-shadow hover:shadow-md">
        <CardBody className="flex items-center gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_CLASSES[tone]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            {value === null ? (
              <Skeleton className="mt-1 h-6 w-10" />
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums text-navy-900">{value}</p>
                {caption && <p className="mt-0.5 text-xs text-slate-500">{caption}</p>}
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [usersState, setUsersState] = useState<UsersRequestState>({ phase: "idle" });

  const [patientCount, setPatientCount] = useState<StatValue>(null);
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[] | "forbidden" | null>(
    null,
  );
  const [inQueue, setInQueue] = useState<StatValue>(null);
  const [lowStock, setLowStock] = useState<StatValue>(null);
  const [beds, setBeds] = useState<BedsSummary>(null);

  useEffect(() => {
    const isForbidden = (err: unknown) =>
      axios.isAxiosError(err) && err.response?.status === 403;

    listPatients()
      .then((data) => setPatientCount(data.count))
      .catch((err) => setPatientCount(isForbidden(err) ? "forbidden" : null));

    const today = new Date().toISOString().slice(0, 10);
    listAppointments({ date: today })
      .then(setTodaysAppointments)
      .catch((err) => setTodaysAppointments(isForbidden(err) ? "forbidden" : null));

    listQueue()
      .then((data) => setInQueue(data.length))
      .catch((err) => setInQueue(isForbidden(err) ? "forbidden" : null));

    listInventoryItems({ low_stock: true })
      .then((data) => setLowStock(data.length))
      .catch((err) => setLowStock(isForbidden(err) ? "forbidden" : null));

    getBedOccupancySummary()
      .then(setBeds)
      .catch((err) => setBeds(isForbidden(err) ? "forbidden" : null));
  }, []);

  const handleViewAllUsers = async () => {
    setUsersState({ phase: "loading" });
    try {
      const users = await fetchAllUsers();
      setUsersState({ phase: "ok", users });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setUsersState({ phase: "forbidden" });
      } else {
        setUsersState({ phase: "error", message: "Could not load users." });
      }
    }
  };

  if (!user) return null;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

  const occupancyPct =
    beds && beds !== "forbidden" && beds.total > 0
      ? Math.round((beds.occupied / beds.total) * 100)
      : 0;

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <div>
        <h2 className="text-2xl font-semibold text-navy-900">
          {greeting()}, {displayName}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          <span>{accraDateLabel()}</span> · Here's what's happening today.
        </p>
        <p className="sr-only">
          Signed in as <span>{user.email}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Patients" value={patientCount} to="/patients" tone="blue" />
        <StatCard
          icon={CalendarDays}
          label="Appointments today"
          value={
            todaysAppointments === null
              ? null
              : todaysAppointments === "forbidden"
                ? "forbidden"
                : todaysAppointments.length
          }
          to="/appointments"
          tone="emerald"
        />
        <StatCard icon={ListOrdered} label="In queue now" value={inQueue} to="/queue" tone="amber" />
        <StatCard
          icon={BedDouble}
          label="Beds occupied"
          value={beds === null ? null : beds === "forbidden" ? "forbidden" : `${beds.occupied} / ${beds.total}`}
          caption={beds && beds !== "forbidden" ? `${occupancyPct}% occupancy` : undefined}
          to="/admissions"
          tone="purple"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low stock items"
          value={lowStock}
          to="/inventory"
          tone="red"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy-900">Today's appointments</h3>
          <Link to="/appointments" className="text-sm font-medium text-accent-600 hover:text-accent-700">
            See all
          </Link>
        </div>

        {todaysAppointments === "forbidden" ? null : (
          <Table>
            <TableHead>
              <TableRow>
                <Th>Time</Th>
                <Th>Patient</Th>
                <Th>Doctor</Th>
                <Th>Department</Th>
                <Th>Status</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {todaysAppointments === null &&
                [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    <Td colSpan={5}>
                      <Skeleton className="h-4 w-full" />
                    </Td>
                  </TableRow>
                ))}
              {todaysAppointments !== null &&
                todaysAppointments.length === 0 && (
                  <TableRow>
                    <Td colSpan={5} className="py-6 text-center text-slate-400">
                      No appointments scheduled for today.
                    </Td>
                  </TableRow>
                )}
              {todaysAppointments !== null &&
                [...todaysAppointments]
                  .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
                  .slice(0, 6)
                  .map((appt) => (
                    <TableRow key={appt.id}>
                      <Td className="tabular-nums">{accraTimeLabel(appt.scheduled_at)}</Td>
                      <Td className="font-medium text-navy-900">{appt.patient_name}</Td>
                      <Td>{appt.doctor_name ?? "Unassigned"}</Td>
                      <Td>{appt.department_name}</Td>
                      <Td>
                        <StatusPill status={appt.status} />
                      </Td>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-accent-600" />
            <CardTitle>RBAC check</CardTitle>
          </div>
          {user.role && <Badge tone="neutral">{humanize(user.role.name)}</Badge>}
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            This calls <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">GET /api/v1/users/</code>,
            which only System Administrator and Hospital Administrator are granted — every other
            role should see a 403 below, enforced by the backend, not hidden by the UI.
          </p>
          <div>
            <Button variant="secondary" size="sm" onClick={handleViewAllUsers}>
              View all staff accounts
            </Button>
          </div>

          {usersState.phase === "loading" && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          {usersState.phase === "forbidden" && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              403 Forbidden — your role ({user.role?.name}) does not have users.view. This is
              the RBAC deny path working as intended.
            </p>
          )}
          {usersState.phase === "error" && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {usersState.message}
            </p>
          )}
          {usersState.phase === "ok" && (
            <ul className="flex flex-col divide-y divide-slate-100 text-sm">
              {usersState.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{u.email}</span>
                  <Badge tone="neutral">{u.role?.name ?? "no role"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
