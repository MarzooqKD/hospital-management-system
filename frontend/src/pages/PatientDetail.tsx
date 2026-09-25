import axios from "axios";
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  IdCard,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
  Skeleton,
} from "../components/ui";
import { listMedicalRecords } from "../services/consultations";
import {
  addAllergy,
  addInsurance,
  deactivateAllergy,
  getPatient,
  listAllergies,
  listInsurance,
  setPatientActive,
  verifyInsurance,
} from "../services/patients";
import type {
  Allergy,
  AllergySeverity,
  EligibilityResult,
  Insurance,
  Patient,
} from "../types/patient";
import type { MedicalRecord } from "../types/consultation";

const SEVERITY_TONE: Record<AllergySeverity, "warning" | "danger"> = {
  mild: "warning",
  moderate: "warning",
  severe: "danger",
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-navy-900">{value}</dd>
    </div>
  );
}

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [insurance, setInsurance] = useState<Insurance[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddInsurance, setShowAddInsurance] = useState(false);
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [verifyResults, setVerifyResults] = useState<Record<string, EligibilityResult>>({});
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getPatient(id), listInsurance(id), listAllergies(id)])
      .then(([patientData, insuranceData, allergyData]) => {
        setPatient(patientData);
        setInsurance(insuranceData);
        setAllergies(allergyData);
      })
      .catch(() => setLoadError("Could not load this patient."));
    // Medical records are gated by the "consultation" module, which not
    // every role holds (docs/RBAC.md) — load separately so a 403 here
    // doesn't block the rest of the profile from rendering.
    listMedicalRecords(id)
      .then(setMedicalRecords)
      .catch(() => undefined);
  }, [id]);

  const handleVerify = async (insuranceId: string) => {
    if (!id) return;
    const result = await verifyInsurance(id, insuranceId);
    setVerifyResults((prev) => ({ ...prev, [insuranceId]: result }));
  };

  const handleToggleActive = async () => {
    if (!id || !patient) return;
    setStatusSubmitting(true);
    setStatusError(null);
    try {
      const updated = await setPatientActive(id, !patient.is_active);
      setPatient(updated);
      setShowStatusConfirm(false);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setStatusError("403 Forbidden — your role does not have patients.edit.");
      } else {
        setStatusError("Could not update this patient's status.");
      }
    } finally {
      setStatusSubmitting(false);
    }
  };

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }
  if (!patient) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${patient.first_name} ${patient.last_name}`} size="lg" />
          <div>
            <h2 className="text-xl font-semibold text-navy-900">
              {patient.first_name} {patient.last_name}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
              <span className="font-mono text-xs">{patient.patient_number}</span>
              <Badge tone={patient.is_active ? "success" : "danger"}>
                {patient.is_active ? "Active" : "Deleted"}
              </Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/queue/check-in?patient=${patient.id}`}>
            <Button variant="secondary">Check in</Button>
          </Link>
          <Link to={`/appointments/book?patient=${patient.id}`}>
            <Button variant="accent" leftIcon={<CalendarDays className="h-4 w-4" />}>
              Book appointment
            </Button>
          </Link>
          <Button
            variant={patient.is_active ? "destructive" : "secondary"}
            leftIcon={
              patient.is_active ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )
            }
            onClick={() => {
              setStatusError(null);
              setShowStatusConfirm(true);
            }}
          >
            {patient.is_active ? "Delete" : "Restore"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="divide-y divide-slate-100">
            <DetailRow label="Date of birth" value={patient.date_of_birth} />
            <DetailRow label="Gender" value={<span className="capitalize">{patient.gender}</span>} />
            <DetailRow label="Blood group" value={patient.blood_group} />
            <DetailRow
              label="Phone"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {patient.phone}
                </span>
              }
            />
            {patient.email && <DetailRow label="Email" value={patient.email} />}
            {patient.ghana_card_number && (
              <DetailRow
                label="Ghana Card"
                value={
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                    <IdCard className="h-3.5 w-3.5 text-slate-400" />
                    {patient.ghana_card_number}
                  </span>
                }
              />
            )}
            {patient.nhis_number && (
              <DetailRow label="NHIS number" value={<span className="font-mono text-xs">{patient.nhis_number}</span>} />
            )}
            {(patient.address_region || patient.address_district || patient.address_town) && (
              <DetailRow
                label="Address"
                value={[patient.address_town, patient.address_district, patient.address_region]
                  .filter(Boolean)
                  .join(", ")}
              />
            )}
            {patient.emergency_contact_name && (
              <DetailRow
                label="Emergency contact"
                value={
                  <>
                    {patient.emergency_contact_name}
                    {patient.emergency_contact_relationship &&
                      ` (${patient.emergency_contact_relationship})`}
                    {patient.emergency_contact_phone && ` — ${patient.emergency_contact_phone}`}
                  </>
                }
              />
            )}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-accent-600" />
            <CardTitle>Insurance</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAddInsurance((v) => !v)}>
            {showAddInsurance ? "Cancel" : "Add insurance"}
          </Button>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {insurance.length === 0 && !showAddInsurance && (
            <p className="text-sm text-slate-500">No insurance recorded.</p>
          )}

          {insurance.map((record) => (
            <div key={record.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium text-navy-900">{record.provider_name}</span>{" "}
                  <Badge tone="neutral">{record.provider_type.toUpperCase()}</Badge>
                  <p className="mt-0.5 text-slate-500">
                    {record.policy_number}
                    {record.member_id && ` — member ${record.member_id}`}
                  </p>
                </div>
                {record.provider_type === "nhis" && (
                  <Button variant="ghost" size="sm" onClick={() => handleVerify(record.id)}>
                    Verify eligibility
                  </Button>
                )}
              </div>
              {verifyResults[record.id] && (
                <p
                  className={`mt-2 text-sm ${
                    verifyResults[record.id].eligible ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {verifyResults[record.id].eligible ? "Eligible" : "Not eligible"} —{" "}
                  {verifyResults[record.id].message}
                </p>
              )}
            </div>
          ))}

          {showAddInsurance && id && (
            <AddInsuranceForm
              patientId={id}
              onAdded={(record) => {
                setInsurance((prev) => [record, ...prev]);
                setShowAddInsurance(false);
              }}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle>Allergies</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAddAllergy((v) => !v)}>
            {showAddAllergy ? "Cancel" : "Add allergy"}
          </Button>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {allergies.length === 0 && !showAddAllergy && (
            <p className="text-sm text-slate-500">No known allergies recorded.</p>
          )}

          {allergies.map((allergy) => (
            <div key={allergy.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
              <div className="text-sm">
                <span className="font-medium text-navy-900">{allergy.allergen}</span>{" "}
                <Badge tone={SEVERITY_TONE[allergy.severity]}>{allergy.severity}</Badge>
                {allergy.reaction && <span className="ml-2 text-slate-500">{allergy.reaction}</span>}
                {!allergy.is_active && <span className="ml-2 text-slate-400">(inactive)</span>}
              </div>
              {allergy.is_active && id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const updated = await deactivateAllergy(id, allergy.id).catch(() => null);
                    if (updated) {
                      setAllergies((prev) => prev.map((a) => (a.id === allergy.id ? updated : a)));
                    }
                  }}
                >
                  Deactivate
                </Button>
              )}
            </div>
          ))}

          {showAddAllergy && id && (
            <AddAllergyForm
              patientId={id}
              onAdded={(allergy) => {
                setAllergies((prev) => [allergy, ...prev]);
                setShowAddAllergy(false);
              }}
            />
          )}
        </CardBody>
      </Card>

      {medicalRecords.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-accent-600" />
              <CardTitle>Medical history</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {medicalRecords.map((record) => (
              <div key={record.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-medium text-navy-900">{record.visit_date}</p>
                <p className="mt-0.5 text-slate-600">
                  {record.diagnosis_summary || "No diagnosis recorded"}
                  {record.treatment_plan && ` — ${record.treatment_plan}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Dr. {record.doctor_name}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Modal
        open={showStatusConfirm}
        onClose={() => setShowStatusConfirm(false)}
        title={patient.is_active ? "Delete patient" : "Restore patient"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowStatusConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant={patient.is_active ? "destructive" : "accent"}
              size="sm"
              isLoading={statusSubmitting}
              onClick={handleToggleActive}
            >
              {statusSubmitting ? "Saving…" : patient.is_active ? "Delete" : "Restore"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {patient.is_active ? (
            <>
              This removes <strong>{patient.first_name} {patient.last_name}</strong> from active
              patient search and blocks new check-ins or appointments for them. Their medical,
              billing, and audit history is legally required to be kept (Ghana's Data Protection
              Act) — nothing is erased, and you can undo this any time from this same page by
              clicking Restore.
            </>
          ) : (
            <>
              This restores <strong>{patient.first_name} {patient.last_name}</strong> — they'll
              show up in active patient search again and can be checked in or booked for
              appointments.
            </>
          )}
        </p>
        {statusError && <p className="mt-3 text-sm text-red-600">{statusError}</p>}
      </Modal>
    </div>
  );
}

function AddInsuranceForm({
  patientId,
  onAdded,
}: {
  patientId: string;
  onAdded: (record: Insurance) => void;
}) {
  const [providerType, setProviderType] = useState<"nhis" | "private">("nhis");
  const [providerName, setProviderName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const record = await addInsurance(patientId, {
        provider_type: providerType,
        provider_name: providerName,
        policy_number: policyNumber,
        member_id: memberId,
        valid_from: null,
        valid_to: null,
      });
      onAdded(record);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError("Could not add insurance record.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-2"
    >
      <Select
        label="Provider type"
        value={providerType}
        onChange={(e) => setProviderType(e.target.value as "nhis" | "private")}
      >
        <option value="nhis">NHIS</option>
        <option value="private">Private insurer</option>
      </Select>
      <Input
        label="Provider name"
        required
        value={providerName}
        onChange={(e) => setProviderName(e.target.value)}
      />
      <Input
        label="Policy number"
        value={policyNumber}
        onChange={(e) => setPolicyNumber(e.target.value)}
      />
      <Input label="Member ID" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
      {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" isLoading={submitting} leftIcon={<Plus className="h-4 w-4" />}>
          Save
        </Button>
      </div>
    </form>
  );
}

function AddAllergyForm({
  patientId,
  onAdded,
}: {
  patientId: string;
  onAdded: (allergy: Allergy) => void;
}) {
  const [allergen, setAllergen] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<AllergySeverity>("mild");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const allergy = await addAllergy(patientId, { allergen, reaction, severity, notes: "" });
      onAdded(allergy);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError("Could not add allergy.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-3"
    >
      <Input label="Allergen" required value={allergen} onChange={(e) => setAllergen(e.target.value)} />
      <Input label="Reaction" value={reaction} onChange={(e) => setReaction(e.target.value)} />
      <Select
        label="Severity"
        value={severity}
        onChange={(e) => setSeverity(e.target.value as AllergySeverity)}
      >
        <option value="mild">Mild</option>
        <option value="moderate">Moderate</option>
        <option value="severe">Severe</option>
      </Select>
      {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      <div className="sm:col-span-3">
        <Button type="submit" size="sm" isLoading={submitting} leftIcon={<Plus className="h-4 w-4" />}>
          Save
        </Button>
      </div>
    </form>
  );
}
