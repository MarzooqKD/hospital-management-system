export type InventoryCategory = "medication" | "consumable" | "equipment" | "other";

export interface InventoryItem {
  id: string;
  medication: string | null;
  medication_name: string | null;
  name: string;
  category: InventoryCategory;
  unit: string;
  quantity_on_hand: number;
  reorder_level: number;
  supplier: number | null;
  supplier_name: string | null;
  is_low_stock: boolean;
  is_active: boolean;
  created_at: string;
}

export type TransactionType = "received" | "issued" | "adjusted";

export interface InventoryTransaction {
  id: number;
  transaction_type: TransactionType;
  quantity_change: number;
  batch_number: string;
  expiry_date: string | null;
  notes: string;
  performed_by_name: string;
  created_at: string;
}
