import { api } from "./api";
import type { Paginated } from "../types/patient";
import type { LabRequest, LabRequestStatus, LabResult, LaboratoryTest } from "../types/laboratory";

export async function listLabTests(): Promise<LaboratoryTest[]> {
  const { data } = await api.get<Paginated<LaboratoryTest>>("/lab/tests/");
  return data.results;
}

export async function listConsultationLabRequests(consultationId: string): Promise<LabRequest[]> {
  const { data } = await api.get<Paginated<LabRequest>>(
    `/consultations/${consultationId}/lab-requests/`,
  );
  return data.results;
}

export async function requestLabTest(
  consultationId: string,
  input: { test: number; priority?: "normal" | "urgent"; notes?: string },
): Promise<LabRequest> {
  const { data } = await api.post<LabRequest>(
    `/consultations/${consultationId}/lab-requests/`,
    input,
  );
  return data;
}

export async function listLabWorklist(status?: LabRequestStatus): Promise<LabRequest[]> {
  const { data } = await api.get<Paginated<LabRequest>>("/lab-requests/", {
    params: status ? { status } : undefined,
  });
  return data.results;
}

export async function updateLabRequestStatus(
  id: string,
  requestStatus: LabRequestStatus,
): Promise<LabRequest> {
  const { data } = await api.patch<LabRequest>(`/lab-requests/${id}/`, { status: requestStatus });
  return data;
}

export async function getLabResult(requestId: string): Promise<LabResult | null> {
  try {
    const { data } = await api.get<LabResult>(`/lab-requests/${requestId}/result/`);
    return data;
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw err;
  }
}

export async function recordLabResult(
  requestId: string,
  input: { result_value: string; is_abnormal: boolean; notes?: string },
): Promise<LabResult> {
  const { data } = await api.post<LabResult>(`/lab-requests/${requestId}/result/`, input);
  return data;
}

export async function validateLabResult(requestId: string): Promise<LabResult> {
  const { data } = await api.post<LabResult>(`/lab-requests/${requestId}/result/validate/`);
  return data;
}
