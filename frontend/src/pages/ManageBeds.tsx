import axios from "axios";
import { BedDouble, DoorOpen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from "../components/ui";
import { listDepartments } from "../services/appointments";
import {
  createBed,
  createRoom,
  createWard,
  listAllBeds,
  listRooms,
  listWards,
} from "../services/admissions";
import type { Department } from "../types/appointment";
import type { Bed, Room, Ward } from "../types/admissions";

function forbiddenMessage(err: unknown, action: string) {
  if (axios.isAxiosError(err) && err.response?.status === 403) {
    return `403 Forbidden — your role does not have ${action}.`;
  }
  return null;
}

export function ManageBeds() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = () => {
    Promise.all([listWards(), listRooms(), listAllBeds()])
      .then(([wardsData, roomsData, bedsData]) => {
        setWards(wardsData);
        setRooms(roomsData);
        setBeds(bedsData);
      })
      .catch(() => setLoadError("Could not load wards, rooms, and beds."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => undefined);
    reload();
  }, []);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Manage wards &amp; beds</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Set up where patients can be admitted — a ward holds rooms, a room holds beds.
          </p>
        </div>
        <Link to="/admissions">
          <Button variant="secondary" size="sm">
            Back to admissions
          </Button>
        </Link>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <WardSection wards={wards} departments={departments} onChanged={reload} />
          <RoomSection wards={wards} rooms={rooms} onChanged={reload} />
          <BedSection rooms={rooms} beds={beds} onChanged={reload} />
        </>
      )}
    </div>
  );
}

function WardSection({
  wards,
  departments,
  onChanged,
}: {
  wards: Ward[];
  departments: Department[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createWard({ name, department: department || undefined });
      setName("");
      setDepartment("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(forbiddenMessage(err, "admissions.create") ?? "Could not create this ward.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <DoorOpen className="h-5 w-5 text-accent-600" />
          <CardTitle>Wards</CardTitle>
        </div>
        <Button
          variant={showForm ? "secondary" : "accent"}
          size="sm"
          leftIcon={!showForm && <Plus className="h-4 w-4" />}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "New ward"}
        </Button>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {wards.length === 0 && <p className="text-sm text-slate-500">No wards yet.</p>}
        {wards.map((ward) => (
          <div
            key={ward.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"
          >
            <span className="font-medium text-navy-900">{ward.name}</span>
            {!ward.is_active && <Badge tone="neutral">Inactive</Badge>}
          </div>
        ))}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-3"
          >
            <Input label="Ward name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Select
              label="Department (optional)"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <div className="flex items-end">
              <Button type="submit" size="sm" fullWidth isLoading={submitting}>
                {submitting ? "Saving…" : "Create ward"}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function RoomSection({
  wards,
  rooms,
  onChanged,
}: {
  wards: Ward[];
  rooms: Room[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [ward, setWard] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ward || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createRoom({ ward: Number(ward), name });
      setName("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(forbiddenMessage(err, "admissions.create") ?? "Could not create this room.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <DoorOpen className="h-5 w-5 text-accent-600" />
          <CardTitle>Rooms</CardTitle>
        </div>
        {wards.length > 0 && (
          <Button
            variant={showForm ? "secondary" : "accent"}
            size="sm"
            leftIcon={!showForm && <Plus className="h-4 w-4" />}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "New room"}
          </Button>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {wards.length === 0 && (
          <p className="text-sm text-slate-500">Create a ward first before adding rooms.</p>
        )}
        {wards.length > 0 && rooms.length === 0 && (
          <p className="text-sm text-slate-500">No rooms yet.</p>
        )}
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"
          >
            <span className="font-medium text-navy-900">
              {room.ward_name} — {room.name}
            </span>
            {!room.is_active && <Badge tone="neutral">Inactive</Badge>}
          </div>
        ))}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-3"
          >
            <Select label="Ward" required value={ward} onChange={(e) => setWard(e.target.value)}>
              <option value="" disabled>
                Choose a ward…
              </option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <Input
              label="Room name"
              required
              placeholder="e.g. 101"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex items-end">
              <Button type="submit" size="sm" fullWidth isLoading={submitting}>
                {submitting ? "Saving…" : "Create room"}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function BedSection({
  rooms,
  beds,
  onChanged,
}: {
  rooms: Room[];
  beds: Bed[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [room, setRoom] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createBed({ room: Number(room), label });
      setLabel("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(forbiddenMessage(err, "admissions.create") ?? "Could not create this bed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <BedDouble className="h-5 w-5 text-accent-600" />
          <CardTitle>Beds</CardTitle>
        </div>
        {rooms.length > 0 && (
          <Button
            variant={showForm ? "secondary" : "accent"}
            size="sm"
            leftIcon={!showForm && <Plus className="h-4 w-4" />}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "New bed"}
          </Button>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {rooms.length === 0 && (
          <p className="text-sm text-slate-500">Create a room first before adding beds.</p>
        )}
        {rooms.length > 0 && beds.length === 0 && (
          <EmptyState icon={BedDouble} title="No beds yet" />
        )}
        {beds.map((bed) => (
          <div
            key={bed.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"
          >
            <span className="font-medium text-navy-900">
              {bed.ward_name} — {bed.room_name} — Bed {bed.label}
            </span>
            <Badge tone={bed.is_occupied ? "warning" : "success"}>
              {bed.is_occupied ? "Occupied" : "Available"}
            </Badge>
          </div>
        ))}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-3"
          >
            <Select label="Room" required value={room} onChange={(e) => setRoom(e.target.value)}>
              <option value="" disabled>
                Choose a room…
              </option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.ward_name} — {r.name}
                </option>
              ))}
            </Select>
            <Input
              label="Bed label"
              required
              placeholder="e.g. A"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <div className="flex items-end">
              <Button type="submit" size="sm" fullWidth isLoading={submitting}>
                {submitting ? "Saving…" : "Create bed"}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          </form>
        )}
      </CardBody>
    </Card>
  );
}
