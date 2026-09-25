export type ReferralType = "internal" | "external";
export type ReferralStatus = "pending" | "accepted" | "completed" | "cancelled";

export interface Referral {
  id: string;
  patient: string;
  patient_name: string;
  visit: string;
  referral_type: ReferralType;
  destination: string;
  reason: string;
  status: ReferralStatus;
  referred_by_name: string;
  created_at: string;
}
