import axios from "axios";
import { FlaskConical } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Input,
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
import {
  listLabWorklist,
  recordLabResult,
  updateLabRequestStatus,
  validateLabResult,
} from "../services/laboratory";
import type { LabRequest, LabRequestStatus } from "../types/laboratory";

export function LabWorklist() {
  const [requests, setRequests] = useState<LabRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<LabRequestStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    listLabWorklist(statusFilter || undefined)
      .then(setRequests)
      .catch(() => setError("Could not load the lab worklist."))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [statusFilter]);

  const handleCollectSample = async (id: string) => {
    setActionError(null);
    try {
      const updated = await updateLabRequestStatus(id, "sample_collected");
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setActionError("Could not mark the sample as collected.");
    }
  };

  const handleValidate = async (id: string) => {
    setActionError(null);
    try {
      await validateLabResult(id);
      reload();
    } catch {
      setActionError("Could not validate this result.");
    }
  };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Select
        aria-label="Filter by status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as LabRequestStatus | "")}
        className="max-w-xs"
      >
        <option value="">Active requests</option>
        <option value="requested">Requested</option>
        <option value="sample_collected">Sample collected</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {loading && <SkeletonTable rows={5} columns={6} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && requests.length === 0 && (
        <EmptyState icon={FlaskConical} title="Nothing in the worklist" />
      )}

      {!loading && !error && requests.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <Th>Patient</Th>
              <Th>Test</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Requested by</Th>
              <Th></Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((r) => (
              <Fragment key={r.id}>
                <TableRow>
                  <Td>
                    <Link
                      to={`/patients/${r.patient}`}
                      className="font-medium text-navy-900 hover:text-accent-600"
                    >
                      {r.patient_name}
                    </Link>
                  </Td>
                  <Td>
                    {r.test_name} <span className="font-mono text-xs text-slate-400">({r.test_code})</span>
                  </Td>
                  <Td>
                    {r.priority === "urgent" ? <Badge tone="danger">Urgent</Badge> : "Normal"}
                  </Td>
                  <Td>
                    <StatusPill status={r.status} />
                  </Td>
                  <Td>{r.requested_by_name}</Td>
                  <Td>
                    {r.status === "requested" && (
                      <Button variant="ghost" size="sm" onClick={() => handleCollectSample(r.id)}>
                        Collect sample
                      </Button>
                    )}
                    {r.status === "sample_collected" && !r.has_result && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        Enter result
                      </Button>
                    )}
                    {r.status === "sample_collected" && r.has_result && (
                      <Button variant="accent" size="sm" onClick={() => handleValidate(r.id)}>
                        Validate
                      </Button>
                    )}
                  </Td>
                </TableRow>
                {expandedId === r.id && (
                  <TableRow>
                    <Td colSpan={6} className="bg-slate-50">
                      <ResultForm
                        requestId={r.id}
                        onSaved={() => {
                          setExpandedId(null);
                          reload();
                        }}
                      />
                    </Td>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ResultForm({ requestId, onSaved }: { requestId: string; onSaved: () => void }) {
  const [resultValue, setResultValue] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await recordLabResult(requestId, { result_value: resultValue, is_abnormal: isAbnormal });
      onSaved();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError("Could not record this result.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-3">
      <Input label="Result" value={resultValue} onChange={(e) => setResultValue(e.target.value)} />
      <Select
        label="Abnormal?"
        value={isAbnormal ? "yes" : "no"}
        onChange={(e) => setIsAbnormal(e.target.value === "yes")}
      >
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </Select>
      <div className="flex items-end">
        <Button type="submit" size="sm" isLoading={submitting}>
          {submitting ? "Saving…" : "Save result"}
        </Button>
      </div>
      {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
    </form>
  );
}
