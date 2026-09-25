import { api } from "./api";
import type {
  Allergy,
  AllergyFormInput,
  EligibilityResult,
  Insurance,
  InsuranceFormInput,
  Paginated,
  Patient,
  PatientFormInput,
  PatientListItem,
} from "../types/patient";

export async function listPatients(
  search = "",
  includeDeleted = false,
): Promise<Paginated<PatientListItem>> {
  const { data } = await api.get<Paginated<PatientListItem>>("/patients/", {
    params: {
      ...(search ? { search } : undefined),
      ...(includeDeleted ? { include_deleted: "true" } : undefined),
    },
  });
  return data;
}

export async function getPatient(id: string): Promise<Patient> {
  const { data } = await api.get<Patient>(`/patients/${id}/`);
  return data;
}

export async function createPatient(input: Partial<PatientFormInput>): Promise<Patient> {
  const { data } = await api.post<Patient>("/patients/", input);
  return data;
}

export async function setPatientActive(id: string, isActive: boolean): Promise<Patient> {
  const { data } = await api.patch<Patient>(`/patients/${id}/`, { is_active: isActive });
  return data;
}

export async function listInsurance(patientId: string): Promise<Insurance[]> {
  const { data } = await api.get<Paginated<Insurance>>(`/patients/${patientId}/insurance/`);
  return data.results;
}

export async function addInsurance(
  patientId: string,
  input: InsuranceFormInput,
): Promise<Insurance> {
  const { data } = await api.post<Insurance>(`/patients/${patientId}/insurance/`, input);
  return data;
}

export async function verifyInsurance(
  patientId: string,
  insuranceId: string,
): Promise<EligibilityResult> {
  const { data } = await api.get<EligibilityResult>(
    `/patients/${patientId}/insurance/${insuranceId}/verify/`,
  );
  return data;
}

export async function listAllergies(patientId: string): Promise<Allergy[]> {
  const { data } = await api.get<Paginated<Allergy>>(`/patients/${patientId}/allergies/`);
  return data.results;
}

export async function addAllergy(
  patientId: string,
  input: AllergyFormInput,
): Promise<Allergy> {
  const { data } = await api.post<Allergy>(`/patients/${patientId}/allergies/`, input);
  return data;
}

export async function deactivateAllergy(patientId: string, allergyId: string): Promise<Allergy> {
  const { data } = await api.patch<Allergy>(
    `/patients/${patientId}/allergies/${allergyId}/`,
    { is_active: false },
  );
  return data;
}
