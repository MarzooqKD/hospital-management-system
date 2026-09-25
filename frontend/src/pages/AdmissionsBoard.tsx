import { BedDouble } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
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
import { listAdmissions } from "../services/admissions";
import type { Admission } from "../types/admissions";

export function AdmissionsBoard() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAdmissions("admitted")
      .then(setAdmissions)
      .catch(() => setError("Could not load admissions."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex justify-end">
        <Link to="/admissions/beds">
          <Button variant="secondary" size="sm" leftIcon={<BedDouble className="h-4 w-4" />}>
            Manage wards &amp; beds
          </Button>
        </Link>
      </div>

      {loading && <SkeletonTable rows={5} columns={5} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && admissions.length === 0 && (
        <EmptyState icon={BedDouble} title="No one is currently admitted" />
      )}

      {!loading && !error && admissions.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <Th>Patient</Th>
              <Th>Bed</Th>
              <Th>Reason</Th>
              <Th>Admitted by</Th>
              <Th></Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {admissions.map((admission) => (
              <TableRow key={admission.id}>
                <Td className="font-medium text-navy-900">{admission.patient_name}</Td>
                <Td>{admission.bed_label}</Td>
                <Td className="text-slate-500">{admission.reason}</Td>
                <Td>{admission.admitted_by_name}</Td>
                <Td>
                  <Link
                    to={`/visits/${admission.visit}`}
                    className="font-medium text-accent-600 hover:text-accent-700"
                  >
                    Manage
                  </Link>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
