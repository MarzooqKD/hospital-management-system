export interface Medication {
  id: string;
  name: string;
  generic_name: string;
  form: string;
  strength: string;
  unit: string;
}

export type PrescriptionItemStatus = "pending" | "dispensed" | "cancelled";

export interface PrescriptionItem {
  id: string;
  medication: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string;
  quantity_prescribed: number;
  quantity_dispensed: number;
  status: PrescriptionItemStatus;
  created_at: string;
}

export type PrescriptionStatus = "pending" | "partially_dispensed" | "dispensed" | "cancelled";

export interface Prescription {
  id: string;
  patient_name: string;
  doctor: string;
  doctor_name: string;
  status: PrescriptionStatus;
  notes: string;
  items: PrescriptionItem[];
  created_at: string;
}
