export interface VitalSign {
  id: string;
  temperature_celsius: string | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  pulse_bpm: number | null;
  respiratory_rate: number | null;
  spo2_percent: number | null;
  weight_kg: string | null;
  height_cm: string | null;
  bmi: string | null;
  notes: string;
  recorded_by_name: string;
  created_at: string;
}

export type VitalSignInput = Partial<
  Omit<VitalSign, "id" | "bmi" | "recorded_by_name" | "created_at">
>;

export type DiagnosisType = "primary" | "differential";

export interface Diagnosis {
  id: string;
  condition: string;
  diagnosis_type: DiagnosisType;
  notes: string;
  diagnosed_by_name: string;
  created_at: string;
}

export type ConsultationStatus = "in_progress" | "completed";

export interface Consultation {
  id: string;
  doctor: string;
  doctor_name: string;
  chief_complaint: string;
  symptoms: string;
  clinical_notes: string;
  treatment_plan: string;
  follow_up_instructions: string;
  follow_up_date: string | null;
  status: ConsultationStatus;
  completed_at: string | null;
  diagnoses: Diagnosis[];
  created_at: string;
  updated_at: string;
}

export type ConsultationInput = Partial<
  Pick<
    Consultation,
    | "chief_complaint"
    | "symptoms"
    | "clinical_notes"
    | "treatment_plan"
    | "follow_up_instructions"
    | "follow_up_date"
  >
>;

export interface MedicalRecord {
  id: string;
  visit_date: string;
  chief_complaint: string;
  diagnosis_summary: string;
  treatment_plan: string;
  doctor_name: string;
  created_at: string;
}
