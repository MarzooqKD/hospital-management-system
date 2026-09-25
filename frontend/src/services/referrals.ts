import { api } from "./api";
import type { Paginated } from "../types/patient";
import type { Referral, ReferralStatus, ReferralType } from "../types/referrals";

export async function listVisitReferrals(visitId: string): Promise<Referral[]> {
  const { data } = await api.get<Paginated<Referral>>(`/visits/${visitId}/referrals/`);
  return data.results;
}

export async function createReferral(
  visitId: string,
  input: { referral_type: ReferralType; destination: string; reason: string },
): Promise<Referral> {
  const { data } = await api.post<Referral>(`/visits/${visitId}/referrals/`, input);
  return data;
}

export async function listReferrals(status?: ReferralStatus): Promise<Referral[]> {
  const { data } = await api.get<Paginated<Referral>>("/referrals/", {
    params: status ? { status } : undefined,
  });
  return data.results;
}

export async function updateReferralStatus(
  id: string,
  status: ReferralStatus,
): Promise<Referral> {
  const { data } = await api.patch<Referral>(`/referrals/${id}/`, { status });
  return data;
}
