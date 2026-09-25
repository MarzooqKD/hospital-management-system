import { api } from "./api";
import type { Paginated } from "../types/patient";
import type { CheckInInput, QueueEntry, QueueStatus, Visit } from "../types/queue";

export async function getVisit(visitId: string): Promise<Visit> {
  const { data } = await api.get<Visit>(`/visits/${visitId}/`);
  return data;
}

export async function checkIn(input: CheckInInput): Promise<QueueEntry> {
  const { data } = await api.post<QueueEntry>("/queue/check-in/", input);
  return data;
}

export async function listQueue(filters: { department?: string; status?: QueueStatus } = {}) {
  const { data } = await api.get<Paginated<QueueEntry>>("/queue/", { params: filters });
  return data.results;
}

export async function updateQueueStatus(
  id: string,
  status: QueueStatus,
): Promise<QueueEntry> {
  const { data } = await api.patch<QueueEntry>(`/queue/${id}/`, { status });
  return data;
}
