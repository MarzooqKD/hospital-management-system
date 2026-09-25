import { api } from "./api";
import type { Paginated } from "../types/patient";
import type { Admission, AdmissionStatus, Bed, Room, Ward } from "../types/admissions";

export async function listAvailableBeds(): Promise<Bed[]> {
  const { data } = await api.get<Paginated<Bed>>("/admissions/beds/", {
    params: { available: "true" },
  });
  return data.results;
}

export async function listAllBeds(): Promise<Bed[]> {
  const { data } = await api.get<Paginated<Bed>>("/admissions/beds/");
  return data.results;
}

/** Uses each request's `count`, not `results.length` — the list endpoint is
 * paginated (page size 25), so reading `results` alone would undercount any
 * hospital with more beds than that. */
export async function getBedOccupancySummary(): Promise<{ total: number; occupied: number }> {
  const [{ data: all }, { data: available }] = await Promise.all([
    api.get<Paginated<Bed>>("/admissions/beds/"),
    api.get<Paginated<Bed>>("/admissions/beds/", { params: { available: "true" } }),
  ]);
  return { total: all.count, occupied: all.count - available.count };
}

export async function createBed(input: { room: number; label: string }): Promise<Bed> {
  const { data } = await api.post<Bed>("/admissions/beds/", input);
  return data;
}

export async function listWards(): Promise<Ward[]> {
  const { data } = await api.get<Paginated<Ward>>("/admissions/wards/");
  return data.results;
}

export async function createWard(input: { name: string; department?: string }): Promise<Ward> {
  const { data } = await api.post<Ward>("/admissions/wards/", input);
  return data;
}

export async function listRooms(): Promise<Room[]> {
  const { data } = await api.get<Paginated<Room>>("/admissions/rooms/");
  return data.results;
}

export async function createRoom(input: { ward: number; name: string }): Promise<Room> {
  const { data } = await api.post<Room>("/admissions/rooms/", input);
  return data;
}

export async function getVisitAdmission(visitId: string): Promise<Admission | null> {
  try {
    const { data } = await api.get<Admission>(`/visits/${visitId}/admission/`);
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

export async function admitPatient(
  visitId: string,
  input: { bed: number; reason?: string },
): Promise<Admission> {
  const { data } = await api.post<Admission>(`/visits/${visitId}/admission/`, input);
  return data;
}

export async function listAdmissions(status?: AdmissionStatus): Promise<Admission[]> {
  const { data } = await api.get<Paginated<Admission>>("/admissions/", {
    params: status ? { status } : undefined,
  });
  return data.results;
}

export async function transferAdmission(admissionId: string, bed: number): Promise<Admission> {
  const { data } = await api.post<Admission>(`/admissions/${admissionId}/transfer/`, { bed });
  return data;
}

export async function dischargeAdmission(
  admissionId: string,
  input: { summary: string; follow_up_instructions?: string },
): Promise<Admission> {
  const { data } = await api.post<Admission>(`/admissions/${admissionId}/discharge/`, input);
  return data;
}
