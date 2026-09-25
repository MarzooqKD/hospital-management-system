export type AdmissionStatus = "admitted" | "discharged";

export interface Ward {
  id: number;
  name: string;
  department: string | null;
  is_active: boolean;
}

export interface Room {
  id: number;
  ward: number;
  ward_name: string;
  name: string;
  is_active: boolean;
}

export interface Bed {
  id: number;
  room: number;
  room_name: string;
  ward_name: string;
  label: string;
  is_occupied: boolean;
  is_active: boolean;
}

export interface Discharge {
  id: string;
  summary: string;
  follow_up_instructions: string;
  discharged_by_name: string;
  created_at: string;
}

export interface Admission {
  id: string;
  patient: string;
  patient_name: string;
  visit: string;
  bed: number;
  bed_label: string;
  reason: string;
  status: AdmissionStatus;
  admitted_by_name: string;
  discharge: Discharge | null;
  created_at: string;
}
