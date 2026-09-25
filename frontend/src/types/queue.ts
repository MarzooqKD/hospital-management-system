export type QueuePriority = "normal" | "emergency";
export type QueueStatus = "waiting" | "in_consultation" | "completed" | "cancelled";

export interface QueueEntry {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_name: string;
  patient_number: string;
  department_name: string;
  doctor: string | null;
  doctor_name: string | null;
  queue_number: number;
  priority: QueuePriority;
  status: QueueStatus;
  called_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type VisitStatus = "active" | "closed";

export interface Visit {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_number: string;
  department_name: string;
  status: VisitStatus;
  created_at: string;
  closed_at: string | null;
}

export interface CheckInInput {
  patient: string;
  department: string;
  appointment?: string | null;
  priority?: QueuePriority;
}
