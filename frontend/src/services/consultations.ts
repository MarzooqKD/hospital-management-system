import { api } from "./api";
import type { Paginated } from "../types/patient";
import type {
  Consultation,
  ConsultationInput,
  Diagnosis,
  MedicalRecord,
  VitalSign,
  VitalSignInput,
} from "../types/consultation";

export async function listVitals(visitId: string): Promise<VitalSign[]> {
  const { data } = await api.get<Paginated<VitalSign>>(`/visits/${visitId}/vitals/`);
  return data.results;
}

export async function recordVitals(visitId: string, input: VitalSignInput): Promise<VitalSign> {
  const { data } = await api.post<VitalSign>(`/visits/${visitId}/vitals/`, input);
  return data;
}

export async function getConsultation(visitId: string): Promise<Consultation | null> {
  try {
    const { data } = await api.get<Consultation>(`/visits/${visitId}/consultation/`);
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

export async function startConsultation(
  visitId: string,
  input: ConsultationInput = {},
): Promise<Consultation> {
  const { data } = await api.post<Consultation>(`/visits/${visitId}/consultation/`, input);
  return data;
}

export async function updateConsultation(
  visitId: string,
  input: ConsultationInput,
): Promise<Consultation> {
  const { data } = await api.patch<Consultation>(`/visits/${visitId}/consultation/`, input);
  return data;
}

export async function completeConsultation(
  visitId: string,
): Promise<{ consultation: Consultation; medical_record: MedicalRecord }> {
  const { data } = await api.post(`/visits/${visitId}/consultation/complete/`);
  return data;
}

export async function addDiagnosis(
  consultationId: string,
  input: { condition: string; diagnosis_type: "primary" | "differential"; notes?: string },
): Promise<Diagnosis> {
  const { data } = await api.post<Diagnosis>(
    `/consultations/${consultationId}/diagnoses/`,
    input,
  );
  return data;
}

export async function listMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  const { data } = await api.get<Paginated<MedicalRecord>>(
    `/patients/${patientId}/medical-records/`,
  );
  return data.results;
}
