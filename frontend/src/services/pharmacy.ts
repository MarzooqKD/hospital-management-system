import { api } from "./api";
import type { Paginated } from "../types/patient";
import type { Medication, Prescription, PrescriptionItem, PrescriptionStatus } from "../types/pharmacy";

export async function listMedications(search = ""): Promise<Medication[]> {
  const { data } = await api.get<Paginated<Medication>>("/pharmacy/medications/", {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function getConsultationPrescription(
  consultationId: string,
): Promise<Prescription | null> {
  try {
    const { data } = await api.get<Prescription>(`/consultations/${consultationId}/prescription/`);
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

export async function startPrescription(consultationId: string): Promise<Prescription> {
  const { data } = await api.post<Prescription>(`/consultations/${consultationId}/prescription/`, {});
  return data;
}

export async function addPrescriptionItem(
  prescriptionId: string,
  input: {
    medication: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    instructions?: string;
    quantity_prescribed: number;
  },
): Promise<PrescriptionItem> {
  const { data } = await api.post<PrescriptionItem>(
    `/prescriptions/${prescriptionId}/items/`,
    input,
  );
  return data;
}

export async function listPharmacyWorklist(status?: PrescriptionStatus): Promise<Prescription[]> {
  const { data } = await api.get<Paginated<Prescription>>("/prescriptions/", {
    params: status ? { status } : undefined,
  });
  return data.results;
}

export async function getPrescription(id: string): Promise<Prescription> {
  const { data } = await api.get<Prescription>(`/prescriptions/${id}/`);
  return data;
}

export async function dispenseItem(
  prescriptionId: string,
  itemId: string,
  quantity: number,
): Promise<PrescriptionItem> {
  const { data } = await api.post<PrescriptionItem>(
    `/prescriptions/${prescriptionId}/items/${itemId}/dispense/`,
    { quantity },
  );
  return data;
}
