export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export interface Appointment {
  id: string;
  patient: string;
  patient_name: string;
  department: string;
  department_name: string;
  doctor: string | null;
  doctor_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  reason: string;
  notes: string;
  created_at: string;
}

export interface AppointmentFormInput {
  patient: string;
  department: string;
  scheduled_at: string;
  reason: string;
}
