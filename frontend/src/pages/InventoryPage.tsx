import axios from "axios";
import { Package, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Select,
  SkeletonTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
} from "../components/ui";
import { createInventoryItem, listInventoryItems, recordTransaction } from "../services/inventory";
import type { InventoryItem, TransactionType } from "../types/inventory";

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    listInventoryItems({ low_stock: lowStockOnly })
      .then(setItems)
      .catch(() => setError("Could not load inventory."))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [lowStockOnly]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-accent-500 focus:ring-accent-500/30"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
        <Button
          variant={showNewItem ? "secondary" : "accent"}
          size="sm"
          leftIcon={!showNewItem && <Plus className="h-4 w-4" />}
          onClick={() => setShowNewItem((v) => !v)}
        >
          {showNewItem ? "Cancel" : "New item"}
        </Button>
      </div>

      {showNewItem && <NewItemForm onCreated={() => { setShowNewItem(false); reload(); }} />}

      {loading && <SkeletonTable rows={5} columns={5} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <EmptyState icon={Package} title="No items found" />
      )}

      {!loading && !error && items.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <Th>Item</Th>
              <Th>Category</Th>
              <Th>On hand</Th>
              <Th>Reorder level</Th>
              <Th></Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <Td className="font-medium text-navy-900">{item.name}</Td>
                <Td className="capitalize">{item.category}</Td>
                <Td className="tabular-nums">
                  {item.quantity_on_hand} {item.unit}
                  {item.is_low_stock && (
                    <Badge tone="danger" className="ml-2">
                      Low
                    </Badge>
                  )}
                </Td>
                <Td className="tabular-nums text-slate-500">{item.reorder_level}</Td>
                <Td>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    {expandedId === item.id ? "Close" : "Record movement"}
                  </Button>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {expandedId && (
        <TransactionForm
          itemId={expandedId}
          onSaved={() => {
            setExpandedId(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function NewItemForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("consumable");
  const [unit, setUnit] = useState("");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createInventoryItem({
        name,
        category,
        unit,
        reorder_level: Number(reorderLevel) || 0,
      });
      onCreated();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("403 Forbidden — your role does not have inventory.create.");
      } else {
        setError("Could not create this item.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="medication">Medication</option>
              <option value="consumable">Consumable</option>
              <option value="equipment">Equipment</option>
              <option value="other">Other</option>
            </Select>
            <Input
              label="Unit"
              required
              placeholder="box, roll, vial…"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
            <Input
              label="Reorder level"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <Button type="submit" size="sm" isLoading={submitting}>
              {submitting ? "Saving…" : "Create item"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function TransactionForm({ itemId, onSaved }: { itemId: string; onSaved: () => void }) {
  const [type, setType] = useState<TransactionType>("received");
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await recordTransaction(itemId, {
        transaction_type: type,
        quantity: Number(quantity),
        batch_number: batchNumber,
      });
      onSaved();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("403 Forbidden — your role does not have inventory.edit.");
      } else {
        setError("Could not record this movement.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 text-base font-semibold text-navy-900">Record stock movement</h2>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
              <option value="received">Received</option>
              <option value="issued">Issued</option>
              <option value="adjusted">Adjusted (+/-)</option>
            </Select>
            <Input
              label="Quantity"
              required
              placeholder={type === "adjusted" ? "e.g. -3 or 5" : "e.g. 50"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {type === "received" && (
              <Input
                label="Batch number"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
              />
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <Button type="submit" size="sm" isLoading={submitting}>
              {submitting ? "Saving…" : "Record movement"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
