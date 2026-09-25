import { api } from "./api";
import type { Appointment, AppointmentFormInput, Department } from "../types/appointment";
import type { Paginated } from "../types/patient";

export async function listDepartments(): Promise<Department[]> {
  const { data } = await api.get<Paginated<Department>>("/departments/");
  return data.results;
}

export interface AppointmentFilters {
  department?: string;
  date?: string;
}

export async function listAppointments(
  filters: AppointmentFilters = {},
): Promise<Appointment[]> {
  const { data } = await api.get<Paginated<Appointment>>("/appointments/", {
    params: filters,
  });
  return data.results;
}

export async function createAppointment(input: AppointmentFormInput): Promise<Appointment> {
  const { data } = await api.post<Appointment>("/appointments/", input);
  return data;
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  const { data } = await api.delete<Appointment>(`/appointments/${id}/`);
  return data;
}
