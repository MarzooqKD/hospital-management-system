import { api } from "./api";
import type { Paginated } from "../types/patient";
import type { InventoryItem, InventoryTransaction, TransactionType } from "../types/inventory";

export async function listInventoryItems(
  filters: { category?: string; low_stock?: boolean } = {},
): Promise<InventoryItem[]> {
  const { data } = await api.get<Paginated<InventoryItem>>("/inventory/items/", {
    params: {
      category: filters.category || undefined,
      low_stock: filters.low_stock ? "true" : undefined,
    },
  });
  return data.results;
}

export async function createInventoryItem(input: {
  name: string;
  category: string;
  unit: string;
  reorder_level?: number;
  medication?: string | null;
}): Promise<InventoryItem> {
  const { data } = await api.post<InventoryItem>("/inventory/items/", input);
  return data;
}

export async function listItemTransactions(itemId: string): Promise<InventoryTransaction[]> {
  const { data } = await api.get<InventoryTransaction[]>(`/inventory/items/${itemId}/transactions/`);
  return data;
}

export async function recordTransaction(
  itemId: string,
  input: {
    transaction_type: TransactionType;
    quantity: number;
    batch_number?: string;
    expiry_date?: string | null;
    notes?: string;
  },
): Promise<InventoryTransaction> {
  const { data } = await api.post<InventoryTransaction>(
    `/inventory/items/${itemId}/transactions/`,
    input,
  );
  return data;
}
