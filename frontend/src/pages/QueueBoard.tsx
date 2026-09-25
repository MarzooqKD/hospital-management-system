import axios from "axios";
import { ListOrdered } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
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
import { listDepartments } from "../services/appointments";
import { listQueue, updateQueueStatus } from "../services/queue";
import type { Department } from "../types/appointment";
import type { QueueEntry } from "../types/queue";

export function QueueBoard() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => undefined);
  }, []);

  const reload = () => {
    setLoading(true);
    setError(null);
    listQueue(departmentFilter ? { department: departmentFilter } : {})
      .then(setEntries)
      .catch(() => setError("Could not load the queue."))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [departmentFilter]);

  const handleTransition = async (id: string, status: "in_consultation" | "cancelled") => {
    setActionError(null);
    try {
      const updated = await updateQueueStatus(id, status);
      setEntries((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setActionError("403 Forbidden — your role does not have queue.edit.");
      } else {
        setActionError("Could not update this queue entry.");
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

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {loading && <SkeletonTable rows={5} columns={7} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <EmptyState icon={ListOrdered} title="No one is currently waiting" />
      )}

      {!loading && !error && entries.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <Th>#</Th>
              <Th>Patient</Th>
              <Th>Department</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Doctor</Th>
              <Th></Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <Td className="font-mono tabular-nums text-slate-500">{entry.queue_number}</Td>
                <Td>
                  <Link
                    to={`/patients/${entry.patient_id}`}
                    className="font-medium text-navy-900 hover:text-accent-600"
                  >
                    {entry.patient_name}
                  </Link>
                </Td>
                <Td>{entry.department_name}</Td>
                <Td>
                  {entry.priority === "emergency" ? (
                    <Badge tone="danger">Emergency</Badge>
                  ) : (
                    <span className="text-slate-500">Normal</span>
                  )}
                </Td>
                <Td>
                  <StatusPill status={entry.status} />
                </Td>
                <Td>{entry.doctor_name ?? "—"}</Td>
                <Td>
                  {entry.status === "waiting" && (
                    <div className="flex gap-2">
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => handleTransition(entry.id, "in_consultation")}
                      >
                        Call
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransition(entry.id, "cancelled")}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {entry.status === "in_consultation" && (
                    <Link to={`/visits/${entry.visit_id}`}>
                      <Button variant="secondary" size="sm">
                        Open visit
                      </Button>
                    </Link>
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
