import { Send } from "lucide-react";
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
import { listReferrals, updateReferralStatus } from "../services/referrals";
import type { Referral, ReferralStatus } from "../types/referrals";

export function ReferralsBoard() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    listReferrals(statusFilter || undefined)
      .then(setReferrals)
      .catch(() => setError("Could not load referrals."))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [statusFilter]);

  const handleTransition = async (id: string, status: ReferralStatus) => {
    setActionError(null);
    try {
      const updated = await updateReferralStatus(id, status);
      setReferrals((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      setActionError("Could not update this referral.");
    }
  };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Select
        aria-label="Filter by status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as ReferralStatus | "")}
        className="max-w-xs"
      >
        <option value="">All referrals</option>
        <option value="pending">Pending</option>
        <option value="accepted">Accepted</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {loading && <SkeletonTable rows={5} columns={6} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && referrals.length === 0 && (
        <EmptyState icon={Send} title="No referrals found" />
      )}

      {!loading && !error && referrals.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <Th>Patient</Th>
              <Th>Destination</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Referred by</Th>
              <Th></Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {referrals.map((referral) => (
              <TableRow key={referral.id}>
                <Td>
                  <Link
                    to={`/patients/${referral.patient}`}
                    className="font-medium text-navy-900 hover:text-accent-600"
                  >
                    {referral.patient_name}
                  </Link>
                </Td>
                <Td>{referral.destination}</Td>
                <Td className="capitalize">{referral.referral_type}</Td>
                <Td>
                  <StatusPill status={referral.status} />
                </Td>
                <Td>{referral.referred_by_name}</Td>
                <Td>
                  {referral.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => handleTransition(referral.id, "accepted")}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransition(referral.id, "cancelled")}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {referral.status === "accepted" && (
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => handleTransition(referral.id, "completed")}
                    >
                      Mark completed
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
