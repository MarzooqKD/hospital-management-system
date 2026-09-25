export interface PatientListItem {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "male" | "female" | "other";
  phone: string;
  is_active: boolean;
}

export interface Patient extends PatientListItem {
  ghana_card_number: string;
  nhis_number: string;
  alt_phone: string;
  email: string;
  address_region: string;
  address_district: string;
  address_town: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  blood_group: string;
  created_at: string;
  updated_at: string;
}

export type PatientFormInput = Omit<
  Patient,
  "id" | "patient_number" | "is_active" | "created_at" | "updated_at"
>;

export interface Insurance {
  id: string;
  provider_type: "nhis" | "private";
  provider_name: string;
  policy_number: string;
  member_id: string;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
}

export type InsuranceFormInput = Omit<Insurance, "id" | "is_active">;

export interface EligibilityResult {
  eligible: boolean;
  provider_reference: string;
  message: string;
}

export type AllergySeverity = "mild" | "moderate" | "severe";

export interface Allergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: AllergySeverity;
  notes: string;
  recorded_by_name: string;
  is_active: boolean;
  created_at: string;
}

export type AllergyFormInput = Pick<Allergy, "allergen" | "reaction" | "severity" | "notes">;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
