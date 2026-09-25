import { Search, UserPlus, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  SkeletonTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
} from "../components/ui";
import { listPatients } from "../services/patients";
import type { PatientListItem } from "../types/patient";

export function PatientList() {
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      listPatients(search, showDeleted)
        .then((data) => setPatients(data.results))
        .catch(() => setError("Could not load patients."))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search, showDeleted]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="h-10 w-full rounded-full border border-slate-300 bg-white pl-10 pr-4 text-sm text-navy-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
            placeholder="Search by name, patient number, phone, or Ghana Card…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search patients"
          />
        </div>
        <Link to="/patients/new">
          <Button variant="accent" leftIcon={<UserPlus className="h-4 w-4" />}>
            Register patient
          </Button>
        </Link>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-accent-500 focus:ring-accent-500/30"
          checked={showDeleted}
          onChange={(e) => setShowDeleted(e.target.checked)}
        />
        Show deleted patients
      </label>

      {loading && <SkeletonTable rows={6} columns={5} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && patients.length === 0 && (
        <EmptyState
          icon={UserRound}
          title="No patients found"
          description={
            search
              ? "Try a different name, phone number, or Ghana Card number."
              : "Register the first patient to get started."
          }
          action={
            !search && (
              <Link to="/patients/new">
                <Button size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
                  Register patient
                </Button>
              </Link>
            )
          }
        />
      )}

      {!loading && !error && patients.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <Th>Patient</Th>
              <Th>Patient #</Th>
              <Th>Gender</Th>
              <Th>Date of birth</Th>
              <Th>Phone</Th>
              <Th>Status</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <Td>
                  <Link
                    to={`/patients/${patient.id}`}
                    className="flex items-center gap-3 font-medium text-navy-900 hover:text-accent-600"
                  >
                    <Avatar name={`${patient.first_name} ${patient.last_name}`} size="sm" />
                    {patient.first_name} {patient.last_name}
                  </Link>
                </Td>
                <Td className="font-mono text-xs text-slate-500">{patient.patient_number}</Td>
                <Td className="capitalize">{patient.gender}</Td>
                <Td>{patient.date_of_birth}</Td>
                <Td>{patient.phone}</Td>
                <Td>
                  <Badge tone={patient.is_active ? "success" : "danger"}>
                    {patient.is_active ? "Active" : "Deleted"}
                  </Badge>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
