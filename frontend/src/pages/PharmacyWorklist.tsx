import axios from "axios";
import { Pill } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Skeleton,
  StatusPill,
} from "../components/ui";
import { dispenseItem, listPharmacyWorklist } from "../services/pharmacy";
import type { Prescription } from "../types/pharmacy";

export function PharmacyWorklist() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const reload = () => {
    setLoading(true);
    setError(null);
    listPharmacyWorklist()
      .then((data) => setPrescriptions(data.filter((p) => p.status !== "dispensed")))
      .catch(() => setError("Could not load the pharmacy worklist."))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleDispense = async (prescriptionId: string, itemId: string) => {
    const quantity = Number(quantities[itemId]);
    setItemErrors((prev) => ({ ...prev, [itemId]: "" }));
    if (!quantity || quantity <= 0) {
      setItemErrors((prev) => ({ ...prev, [itemId]: "Enter a quantity to dispense." }));
      return;
    }
    try {
      await dispenseItem(prescriptionId, itemId, quantity);
      reload();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setItemErrors((prev) => ({ ...prev, [itemId]: err.response!.data.detail }));
      } else if (axios.isAxiosError(err) && err.response?.data?.quantity) {
        setItemErrors((prev) => ({ ...prev, [itemId]: err.response!.data.quantity[0] }));
      } else {
        setItemErrors((prev) => ({ ...prev, [itemId]: "Could not dispense this item." }));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      {prescriptions.length === 0 && (
        <EmptyState icon={Pill} title="Nothing pending dispensing" />
      )}

      {prescriptions.map((p) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle>
              {p.patient_name} <span className="font-normal text-slate-400">— {p.doctor_name}</span>
            </CardTitle>
            <StatusPill status={p.status} />
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {p.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium text-navy-900">{item.medication_name}</span>{" "}
                    <span className="text-slate-500">
                      — {item.dosage}, {item.frequency}, {item.duration_days} days
                    </span>
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {item.quantity_dispensed}/{item.quantity_prescribed} dispensed
                  </span>
                </div>
                {item.status !== "dispensed" && (
                  <div className="mt-3 flex items-end gap-3">
                    <Input
                      label="Quantity to dispense"
                      className="max-w-[10rem]"
                      value={quantities[item.id] ?? ""}
                      onChange={(e) =>
                        setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                    <Button size="sm" onClick={() => handleDispense(p.id, item.id)}>
                      Dispense
                    </Button>
                  </div>
                )}
                {itemErrors[item.id] && (
                  <p className="mt-2 text-sm text-red-600">{itemErrors[item.id]}</p>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
