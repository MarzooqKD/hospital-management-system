import axios from "axios";
import { CalendarX2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  EmptyState,
  Select,
  SkeletonTable,
  StatusPill,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
} from "../components/ui";
import { cancelAppointment, listAppointments, listDepartments } from "../services/appointments";
import type { Appointment, Department } from "../types/appointment";

export function AppointmentList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listAppointments(departmentFilter ? { department: departmentFilter } : {})
      .then(setAppointments)
      .catch(() => setError("Could not load appointments."))
      .finally(() => setLoading(false));
  }, [departmentFilter]);

  const handleCancel = async (id: string) => {
    setCancelError(null);
    try {
      const updated = await cancelAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setCancelError("403 Forbidden — your role does not have appointments.delete.");
      } else {
        setCancelError("Could not cancel this appointment.");
      }
    }
  };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Select
        aria-label="Filter by department"
        value={departmentFilter}
        onChange={(e) => setDepartmentFilter(e.target.value)}
        className="max-w-xs"
      >
        <option value="">All departments</option>
        {departments.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </Select>

      {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
      {loading && <SkeletonTable rows={6} columns={6} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && appointments.length === 0 && (
        <EmptyState
          icon={CalendarX2}
          title="No appointments found"
          description="Once a patient books, it'll show up here."
        />
      )}

      {!loading && !error && appointments.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <Th>When</Th>
              <Th>Patient</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th>Reason</Th>
              <Th></Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.map((appt) => (
              <TableRow key={appt.id}>
                <Td className="whitespace-nowrap font-mono text-xs text-slate-500">
                  {new Date(appt.scheduled_at).toLocaleString()}
                </Td>
                <Td>
                  <Link to={`/patients/${appt.patient}`} className="font-medium text-navy-900 hover:text-accent-600">
                    {appt.patient_name}
                  </Link>
                </Td>
                <Td>{appt.department_name}</Td>
                <Td>
                  <StatusPill status={appt.status} />
                </Td>
                <Td className="text-slate-500">{appt.reason}</Td>
                <Td>
                  {appt.status !== "cancelled" && (
                    <Button variant="ghost" size="sm" onClick={() => handleCancel(appt.id)}>
                      Cancel
                    </Button>
                  )}
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
