import axios from "axios";
import { Activity, BedDouble, FlaskConical, Pill, Send, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
} from "../components/ui";
import {
  admitPatient,
  dischargeAdmission,
  getVisitAdmission,
  listAvailableBeds,
} from "../services/admissions";
import {
  addDiagnosis,
  completeConsultation,
  getConsultation,
  listVitals,
  recordVitals,
  startConsultation,
  updateConsultation,
} from "../services/consultations";
import { listConsultationLabRequests, listLabTests, requestLabTest } from "../services/laboratory";
import {
  addPrescriptionItem,
  getConsultationPrescription,
  listMedications,
  startPrescription,
} from "../services/pharmacy";
import { getVisit } from "../services/queue";
import { createReferral, listVisitReferrals } from "../services/referrals";
import type { Admission, Bed } from "../types/admissions";
import type { Consultation, DiagnosisType, VitalSign } from "../types/consultation";
import type { LabRequest, LabRequestPriority, LaboratoryTest } from "../types/laboratory";
import type { Medication, Prescription } from "../types/pharmacy";
import type { Visit } from "../types/queue";
import type { Referral, ReferralType } from "../types/referrals";

const emptyNotes = {
  chief_complaint: "",
  symptoms: "",
  clinical_notes: "",
  treatment_plan: "",
  follow_up_instructions: "",
};

export function VisitWorkspace() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [vitalsAccessDenied, setVitalsAccessDenied] = useState(false);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [consultationAccessDenied, setConsultationAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [vitalsForm, setVitalsForm] = useState({
    temperature_celsius: "",
    weight_kg: "",
    height_cm: "",
    pulse_bpm: "",
  });
  const [notes, setNotes] = useState(emptyNotes);
  const [diagnosisForm, setDiagnosisForm] = useState<{
    condition: string;
    diagnosis_type: DiagnosisType;
  }>({ condition: "", diagnosis_type: "primary" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  const [labTests, setLabTests] = useState<LaboratoryTest[]>([]);
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labForm, setLabForm] = useState<{ test: string; priority: LabRequestPriority }>({
    test: "",
    priority: "normal",
  });

  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [itemForm, setItemForm] = useState({
    medication: "",
    dosage: "",
    frequency: "",
    duration_days: "",
    quantity_prescribed: "",
  });

  const [availableBeds, setAvailableBeds] = useState<Bed[]>([]);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [admitForm, setAdmitForm] = useState({ bed: "", reason: "" });
  const [dischargeForm, setDischargeForm] = useState({ summary: "", follow_up_instructions: "" });

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralForm, setReferralForm] = useState<{
    referral_type: ReferralType;
    destination: string;
    reason: string;
  }>({ referral_type: "internal", destination: "", reason: "" });

  useEffect(() => {
    listLabTests().then(setLabTests).catch(() => undefined);
    listMedications().then(setMedications).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!consultation) return;
    listConsultationLabRequests(consultation.id).then(setLabRequests).catch(() => undefined);
    getConsultationPrescription(consultation.id).then(setPrescription).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation?.id]);

  useEffect(() => {
    if (!visitId) return;
    getVisitAdmission(visitId).then(setAdmission).catch(() => undefined);
    listVisitReferrals(visitId).then(setReferrals).catch(() => undefined);
    listAvailableBeds().then(setAvailableBeds).catch(() => undefined);
  }, [visitId]);

  const isForbidden = (err: unknown) => axios.isAxiosError(err) && err.response?.status === 403;

  const load = () => {
    if (!visitId) return;

    // The Visit itself is required — without it there's nothing to render.
    // Vitals and Consultation, by contrast, are two of several independent
    // sections on this page (alongside Admissions/Referrals) — a role that
    // can open the page for one of those may hold no grant on
    // Vitals/Consultation at all, and that 403 shouldn't take down the
    // whole workspace.
    getVisit(visitId)
      .then(setVisit)
      .catch(() => setLoadError("Could not load this visit."));

    listVitals(visitId)
      .then((data) => {
        setVitals(data);
        setVitalsAccessDenied(false);
      })
      .catch((err) => setVitalsAccessDenied(isForbidden(err)));

    getConsultation(visitId)
      .then((consultationData) => {
        setConsultation(consultationData);
        setConsultationAccessDenied(false);
        if (consultationData) {
          setNotes({
            chief_complaint: consultationData.chief_complaint,
            symptoms: consultationData.symptoms,
            clinical_notes: consultationData.clinical_notes,
            treatment_plan: consultationData.treatment_plan,
            follow_up_instructions: consultationData.follow_up_instructions,
          });
        }
      })
      .catch((err) => setConsultationAccessDenied(isForbidden(err)));
  };

  useEffect(load, [visitId]);

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!visit) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitId) return;
    setActionError(null);
    try {
      const saved = await recordVitals(visitId, {
        temperature_celsius: vitalsForm.temperature_celsius || undefined,
        weight_kg: vitalsForm.weight_kg || undefined,
        height_cm: vitalsForm.height_cm || undefined,
        pulse_bpm: vitalsForm.pulse_bpm ? Number(vitalsForm.pulse_bpm) : undefined,
      });
      setVitals((prev) => [saved, ...prev]);
      setVitalsForm({ temperature_celsius: "", weight_kg: "", height_cm: "", pulse_bpm: "" });
    } catch (err) {
      setActionError(
        isForbidden(err)
          ? "403 Forbidden — your role does not have vitals.create. Vitals are recorded by nursing staff."
          : "Could not record vitals.",
      );
    }
  };

  const handleStartConsultation = async () => {
    if (!visitId) return;
    setActionError(null);
    try {
      const started = await startConsultation(visitId);
      setConsultation(started);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setActionError("403 Forbidden — your role does not have consultation.create.");
      } else {
        setActionError("Could not start the consultation.");
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!visitId) return;
    setActionError(null);
    try {
      const updated = await updateConsultation(visitId, notes);
      setConsultation(updated);
    } catch {
      setActionError("Could not save consultation notes.");
    }
  };

  const handleAddDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultation || !diagnosisForm.condition.trim()) return;
    setActionError(null);
    try {
      const diagnosis = await addDiagnosis(consultation.id, diagnosisForm);
      setConsultation((prev) => prev && { ...prev, diagnoses: [...prev.diagnoses, diagnosis] });
      setDiagnosisForm({ condition: "", diagnosis_type: "primary" });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.non_field_errors) {
        setActionError(err.response.data.non_field_errors[0]);
      } else {
        setActionError("Could not add diagnosis.");
      }
    }
  };

  const handleOrderLabTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultation || !labForm.test) return;
    setActionError(null);
    try {
      const req = await requestLabTest(consultation.id, {
        test: Number(labForm.test),
        priority: labForm.priority,
      });
      setLabRequests((prev) => [req, ...prev]);
      setLabForm({ test: "", priority: "normal" });
    } catch {
      setActionError("Could not order this lab test.");
    }
  };

  const handleStartPrescription = async () => {
    if (!consultation) return;
    setActionError(null);
    try {
      const p = await startPrescription(consultation.id);
      setPrescription(p);
    } catch {
      setActionError("Could not start a prescription.");
    }
  };

  const handleAddPrescriptionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescription || !itemForm.medication) return;
    setActionError(null);
    try {
      const item = await addPrescriptionItem(prescription.id, {
        medication: itemForm.medication,
        dosage: itemForm.dosage,
        frequency: itemForm.frequency,
        duration_days: Number(itemForm.duration_days),
        quantity_prescribed: Number(itemForm.quantity_prescribed),
      });
      setPrescription((prev) => prev && { ...prev, items: [...prev.items, item] });
      setItemForm({
        medication: "",
        dosage: "",
        frequency: "",
        duration_days: "",
        quantity_prescribed: "",
      });
    } catch {
      setActionError("Could not add this prescription item.");
    }
  };

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitId || !admitForm.bed) return;
    setActionError(null);
    try {
      const adm = await admitPatient(visitId, {
        bed: Number(admitForm.bed),
        reason: admitForm.reason,
      });
      setAdmission(adm);
      listAvailableBeds().then(setAvailableBeds).catch(() => undefined);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.bed) {
        setActionError(err.response.data.bed[0]);
      } else {
        setActionError("Could not admit this patient.");
      }
    }
  };

  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admission) return;
    setActionError(null);
    try {
      const updated = await dischargeAdmission(admission.id, dischargeForm);
      setAdmission(updated);
    } catch {
      setActionError("Could not discharge this patient.");
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitId || !referralForm.destination || !referralForm.reason) return;
    setActionError(null);
    try {
      const referral = await createReferral(visitId, referralForm);
      setReferrals((prev) => [referral, ...prev]);
      setReferralForm({ referral_type: "internal", destination: "", reason: "" });
    } catch {
      setActionError("Could not create this referral.");
    }
  };

  const handleComplete = async () => {
    if (!visitId) return;
    setActionError(null);
    try {
      const result = await completeConsultation(visitId);
      setConsultation(result.consultation);
      setCompletedMessage("Consultation completed — medical record saved.");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setActionError(err.response.data.detail);
      } else {
        setActionError("Could not complete the consultation.");
      }
    }
  };

  const inProgress = consultation?.status === "in_progress";
  const completed = consultation?.status === "completed";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-500">{visit.patient_number}</p>
          <h2 className="text-xl font-semibold text-navy-900">{visit.patient_name}</h2>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
            {visit.department_name}
            <StatusPill status={visit.status} />
          </p>
        </div>
        <Link to={`/patients/${visit.patient_id}`}>
          <Button variant="secondary" size="sm">
            View patient profile
          </Button>
        </Link>
      </div>

      {actionError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>
      )}
      {completedMessage && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {completedMessage}
        </p>
      )}

      {!vitalsAccessDenied && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-accent-600" />
              <CardTitle>Vitals</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {vitals.length === 0 && <p className="text-sm text-slate-500">No vitals recorded yet.</p>}
            {vitals.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <span className="tabular-nums text-navy-900">
                  {[
                    v.temperature_celsius && `Temp ${v.temperature_celsius} °C`,
                    v.weight_kg && `${v.weight_kg} kg`,
                    v.height_cm && `${v.height_cm} cm`,
                    v.bmi && `BMI ${v.bmi}`,
                    v.pulse_bpm && `Pulse ${v.pulse_bpm} bpm`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="ml-1 text-slate-400">— {v.recorded_by_name}</span>
              </div>
            ))}
            {!completed && (
              <form
                onSubmit={handleRecordVitals}
                className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-5"
              >
                <Input
                  label="Temperature (°C)"
                  value={vitalsForm.temperature_celsius}
                  onChange={(e) =>
                    setVitalsForm((p) => ({ ...p, temperature_celsius: e.target.value }))
                  }
                />
                <Input
                  label="Weight (kg)"
                  value={vitalsForm.weight_kg}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, weight_kg: e.target.value }))}
                />
                <Input
                  label="Height (cm)"
                  value={vitalsForm.height_cm}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, height_cm: e.target.value }))}
                />
                <Input
                  label="Pulse (bpm)"
                  value={vitalsForm.pulse_bpm}
                  onChange={(e) => setVitalsForm((p) => ({ ...p, pulse_bpm: e.target.value }))}
                />
                <div className="flex items-end">
                  <Button type="submit" size="sm" fullWidth>
                    Record vitals
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {!consultationAccessDenied && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Stethoscope className="h-5 w-5 text-accent-600" />
              <CardTitle>Consultation</CardTitle>
            </div>
            {consultation && <StatusPill status={consultation.status} />}
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {!consultation && (
              <div>
                <Button onClick={handleStartConsultation}>Start consultation</Button>
              </div>
            )}

            {consultation && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Textarea
                    label="Chief complaint"
                    rows={2}
                    disabled={!inProgress}
                    value={notes.chief_complaint}
                    onChange={(e) => setNotes((p) => ({ ...p, chief_complaint: e.target.value }))}
                  />
                  <Textarea
                    label="Symptoms"
                    rows={2}
                    disabled={!inProgress}
                    value={notes.symptoms}
                    onChange={(e) => setNotes((p) => ({ ...p, symptoms: e.target.value }))}
                  />
                </div>
                <Textarea
                  label="Clinical notes"
                  rows={3}
                  disabled={!inProgress}
                  value={notes.clinical_notes}
                  onChange={(e) => setNotes((p) => ({ ...p, clinical_notes: e.target.value }))}
                />
                <Textarea
                  label="Treatment plan"
                  rows={3}
                  disabled={!inProgress}
                  value={notes.treatment_plan}
                  onChange={(e) => setNotes((p) => ({ ...p, treatment_plan: e.target.value }))}
                />
                <Textarea
                  label="Follow-up instructions"
                  rows={2}
                  disabled={!inProgress}
                  value={notes.follow_up_instructions}
                  onChange={(e) =>
                    setNotes((p) => ({ ...p, follow_up_instructions: e.target.value }))
                  }
                />
                {inProgress && (
                  <div>
                    <Button variant="secondary" size="sm" onClick={handleSaveNotes}>
                      Save notes
                    </Button>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-navy-900">Diagnoses</h3>
                  <div className="mt-3 flex flex-col gap-2">
                    {consultation.diagnoses.length === 0 && (
                      <p className="text-sm text-slate-500">No diagnosis added yet.</p>
                    )}
                    {consultation.diagnoses.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"
                      >
                        <span>
                          <span className="font-medium text-navy-900">{d.condition}</span>{" "}
                          <Badge tone={d.diagnosis_type === "primary" ? "info" : "neutral"}>
                            {d.diagnosis_type}
                          </Badge>
                        </span>
                        <span className="text-slate-400">{d.diagnosed_by_name}</span>
                      </div>
                    ))}
                  </div>

                  {inProgress && (
                    <form
                      onSubmit={handleAddDiagnosis}
                      className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
                    >
                      <Input
                        label="Condition"
                        value={diagnosisForm.condition}
                        onChange={(e) =>
                          setDiagnosisForm((p) => ({ ...p, condition: e.target.value }))
                        }
                      />
                      <Select
                        label="Type"
                        value={diagnosisForm.diagnosis_type}
                        onChange={(e) =>
                          setDiagnosisForm((p) => ({
                            ...p,
                            diagnosis_type: e.target.value as DiagnosisType,
                          }))
                        }
                      >
                        <option value="primary">Primary</option>
                        <option value="differential">Differential</option>
                      </Select>
                      <div className="flex items-end">
                        <Button type="submit" size="sm" fullWidth>
                          Add diagnosis
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                {inProgress && (
                  <Button
                    variant="accent"
                    onClick={handleComplete}
                    disabled={consultation.diagnoses.length === 0}
                  >
                    Complete consultation
                  </Button>
                )}
                {completed && (
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => navigate("/queue")}>
                      Back to queue
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      {consultation && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <FlaskConical className="h-5 w-5 text-accent-600" />
              <CardTitle>Laboratory</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {labRequests.length === 0 && (
              <p className="text-sm text-slate-500">No lab tests ordered yet.</p>
            )}
            {labRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"
              >
                <span>
                  <span className="font-medium text-navy-900">{r.test_name}</span>{" "}
                  <span className="text-slate-400">({r.test_code})</span>
                  {r.priority === "urgent" && <Badge tone="danger" className="ml-2">Urgent</Badge>}
                </span>
                <StatusPill status={r.status} />
              </div>
            ))}
            {inProgress && (
              <form
                onSubmit={handleOrderLabTest}
                className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-3"
              >
                <Select
                  label="Test"
                  value={labForm.test}
                  onChange={(e) => setLabForm((p) => ({ ...p, test: e.target.value }))}
                >
                  <option value="" disabled>
                    Choose a test…
                  </option>
                  {labTests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </Select>
                <Select
                  label="Priority"
                  value={labForm.priority}
                  onChange={(e) =>
                    setLabForm((p) => ({ ...p, priority: e.target.value as LabRequestPriority }))
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </Select>
                <div className="flex items-end">
                  <Button type="submit" size="sm" fullWidth>
                    Order test
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {consultation && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Pill className="h-5 w-5 text-accent-600" />
              <CardTitle>Prescription</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {!prescription && inProgress && (
              <div>
                <Button onClick={handleStartPrescription}>Start prescription</Button>
              </div>
            )}
            {!prescription && !inProgress && (
              <p className="text-sm text-slate-500">No prescription was issued.</p>
            )}

            {prescription && (
              <>
                {prescription.items.length === 0 && (
                  <p className="text-sm text-slate-500">No medication items added yet.</p>
                )}
                {prescription.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"
                  >
                    <span>
                      <span className="font-medium text-navy-900">{item.medication_name}</span>{" "}
                      <span className="text-slate-500">
                        — {item.dosage}, {item.frequency}, {item.duration_days} days
                      </span>
                    </span>
                    <StatusPill status={item.status} />
                  </div>
                ))}
                {inProgress && (
                  <form
                    onSubmit={handleAddPrescriptionItem}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-3"
                  >
                    <Select
                      label="Medication"
                      value={itemForm.medication}
                      onChange={(e) =>
                        setItemForm((p) => ({ ...p, medication: e.target.value }))
                      }
                    >
                      <option value="" disabled>
                        Choose a medication…
                      </option>
                      {medications.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.strength}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Dosage"
                      placeholder="1 tablet"
                      value={itemForm.dosage}
                      onChange={(e) => setItemForm((p) => ({ ...p, dosage: e.target.value }))}
                    />
                    <Input
                      label="Frequency"
                      placeholder="twice daily"
                      value={itemForm.frequency}
                      onChange={(e) => setItemForm((p) => ({ ...p, frequency: e.target.value }))}
                    />
                    <Input
                      label="Duration (days)"
                      value={itemForm.duration_days}
                      onChange={(e) =>
                        setItemForm((p) => ({ ...p, duration_days: e.target.value }))
                      }
                    />
                    <Input
                      label="Quantity"
                      value={itemForm.quantity_prescribed}
                      onChange={(e) =>
                        setItemForm((p) => ({ ...p, quantity_prescribed: e.target.value }))
                      }
                    />
                    <div className="flex items-end">
                      <Button type="submit" size="sm" fullWidth>
                        Add item
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <BedDouble className="h-5 w-5 text-accent-600" />
            <CardTitle>Admission</CardTitle>
          </div>
          {admission && <StatusPill status={admission.status} />}
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {!admission && (
            <form onSubmit={handleAdmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="Bed"
                value={admitForm.bed}
                onChange={(e) => setAdmitForm((p) => ({ ...p, bed: e.target.value }))}
              >
                <option value="" disabled>
                  Choose a bed…
                </option>
                {availableBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.ward_name} — {b.room_name} — Bed {b.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Reason"
                value={admitForm.reason}
                onChange={(e) => setAdmitForm((p) => ({ ...p, reason: e.target.value }))}
              />
              <div className="flex items-end">
                <Button type="submit" size="sm" fullWidth>
                  Admit patient
                </Button>
              </div>
            </form>
          )}
          {admission && (
            <>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-navy-900">{admission.bed_label}</span> —
                admitted by {admission.admitted_by_name}
              </p>
              {admission.reason && <p className="text-sm text-slate-500">{admission.reason}</p>}
              {admission.status === "admitted" && (
                <form
                  onSubmit={handleDischarge}
                  className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 p-4"
                >
                  <Textarea
                    label="Discharge summary"
                    rows={2}
                    value={dischargeForm.summary}
                    onChange={(e) =>
                      setDischargeForm((p) => ({ ...p, summary: e.target.value }))
                    }
                  />
                  <Textarea
                    label="Follow-up instructions"
                    rows={2}
                    value={dischargeForm.follow_up_instructions}
                    onChange={(e) =>
                      setDischargeForm((p) => ({ ...p, follow_up_instructions: e.target.value }))
                    }
                  />
                  <div>
                    <Button type="submit" variant="secondary" size="sm">
                      Discharge
                    </Button>
                  </div>
                </form>
              )}
              {admission.discharge && (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  Discharged — {admission.discharge.summary}
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Referrals hangs off the Visit directly, not the Consultation
          (apps.referrals.Referral is FK'd to Visit), so this isn't gated on
          `consultation` — a role like Receptionist holds referrals.view but
          no consultation.view grant, and would otherwise never see it. */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Send className="h-5 w-5 text-accent-600" />
            <CardTitle>Referrals</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {referrals.length === 0 && (
            <p className="text-sm text-slate-500">No referrals made yet.</p>
          )}
          {referrals.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm"
            >
              <span>
                <span className="font-medium text-navy-900">{r.destination}</span>{" "}
                <span className="text-slate-400">({r.referral_type})</span>
              </span>
              <StatusPill status={r.status} />
            </div>
          ))}
          <form
            onSubmit={handleCreateReferral}
            className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-slate-200 p-4 sm:grid-cols-2"
          >
            <Select
              label="Type"
              value={referralForm.referral_type}
              onChange={(e) =>
                setReferralForm((p) => ({ ...p, referral_type: e.target.value as ReferralType }))
              }
            >
              <option value="internal">Internal</option>
              <option value="external">External</option>
            </Select>
            <Input
              label="Destination"
              value={referralForm.destination}
              onChange={(e) => setReferralForm((p) => ({ ...p, destination: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Reason"
                rows={2}
                value={referralForm.reason}
                onChange={(e) => setReferralForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Create referral
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
