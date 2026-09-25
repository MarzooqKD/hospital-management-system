export interface LaboratoryTest {
  id: number;
  name: string;
  code: string;
  category: string;
  sample_type: string;
  normal_range_text: string;
}

export type LabRequestStatus = "requested" | "sample_collected" | "completed" | "cancelled";
export type LabRequestPriority = "normal" | "urgent";

export interface LabRequest {
  id: string;
  patient: string;
  patient_name: string;
  consultation: string;
  test: number;
  test_name: string;
  test_code: string;
  status: LabRequestStatus;
  priority: LabRequestPriority;
  notes: string;
  requested_by_name: string;
  has_result: boolean;
  sample_collected_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface LabResult {
  id: string;
  result_value: string | null;
  is_abnormal: boolean | null;
  notes: string;
  performed_by_name: string;
  validated_by_name: string | null;
  validated_at: string | null;
  pending_validation: boolean;
  created_at: string;
}
