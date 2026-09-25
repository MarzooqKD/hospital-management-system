import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryService from "../../services/inventory";
import { InventoryPage } from "../InventoryPage";

vi.mock("../../services/inventory");

const mockedListItems = vi.mocked(inventoryService.listInventoryItems);
const mockedRecordTransaction = vi.mocked(inventoryService.recordTransaction);

const item = {
  id: "item-1",
  medication: null,
  medication_name: null,
  name: "Gauze bandage",
  category: "consumable" as const,
  unit: "roll",
  quantity_on_hand: 20,
  reorder_level: 10,
  supplier: null,
  supplier_name: null,
  is_low_stock: false,
  is_active: true,
  created_at: "",
};

describe("InventoryPage", () => {
  beforeEach(() => {
    mockedListItems.mockReset().mockResolvedValue([item]);
    mockedRecordTransaction.mockReset();
  });

  it("lists inventory items with their quantity on hand", async () => {
    render(<InventoryPage />);

    expect(await screen.findByText("Gauze bandage")).toBeInTheDocument();
    expect(screen.getByText(/20 roll/)).toBeInTheDocument();
  });

  it("records a received stock movement", async () => {
    mockedRecordTransaction.mockResolvedValueOnce({
      id: 1,
      transaction_type: "received",
      quantity_change: 50,
      batch_number: "B1",
      expiry_date: null,
      notes: "",
      performed_by_name: "Pharmacist",
      created_at: "",
    });

    render(<InventoryPage />);
    await userEvent.click(await screen.findByRole("button", { name: /record movement/i }));
    await userEvent.type(screen.getByLabelText(/quantity/i), "50");
    await userEvent.click(screen.getByRole("button", { name: /^record movement$/i }));

    await waitFor(() =>
      expect(mockedRecordTransaction).toHaveBeenCalledWith("item-1", {
        transaction_type: "received",
        quantity: 50,
        batch_number: "",
      }),
    );
  });

  it("filters to low-stock items only", async () => {
    render(<InventoryPage />);
    await screen.findByText("Gauze bandage");

    await userEvent.click(screen.getByLabelText(/low stock only/i));

    await waitFor(() =>
      expect(mockedListItems).toHaveBeenLastCalledWith({ low_stock: true }),
    );
  });
});
