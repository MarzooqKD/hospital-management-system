import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as consultationsService from "../../services/consultations";
import * as queueService from "../../services/queue";
import { VisitWorkspace } from "../VisitWorkspace";

function forbiddenError() {
  return Object.assign(new Error("Forbidden"), {
    isAxiosError: true,
    response: { status: 403 },
  });
}

vi.mock("../../services/consultations");
vi.mock("../../services/queue");

const mockedGetVisit = vi.mocked(queueService.getVisit);
const mockedListVitals = vi.mocked(consultationsService.listVitals);
const mockedRecordVitals = vi.mocked(consultationsService.recordVitals);
const mockedGetConsultation = vi.mocked(consultationsService.getConsultation);
const mockedStartConsultation = vi.mocked(consultationsService.startConsultation);
const mockedAddDiagnosis = vi.mocked(consultationsService.addDiagnosis);
const mockedCompleteConsultation = vi.mocked(consultationsService.completeConsultation);

const visit = {
  id: "visit-1",
  patient_id: "patient-1",
  patient_name: "Ama Mensah",
  patient_number: "PAT-000001",
  department_name: "General Outpatient",
  status: "active" as const,
  created_at: "",
  closed_at: null,
};

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/visits/visit-1"]}>
      <Routes>
        <Route path="/visits/:visitId" element={<VisitWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VisitWorkspace", () => {
  beforeEach(() => {
    mockedGetVisit.mockReset().mockResolvedValue(visit);
    mockedListVitals.mockReset().mockResolvedValue([]);
    mockedRecordVitals.mockReset();
    mockedGetConsultation.mockReset().mockResolvedValue(null);
    mockedStartConsultation.mockReset();
    mockedAddDiagnosis.mockReset();
    mockedCompleteConsultation.mockReset();
  });

  it("shows the visit header and a start-consultation prompt when none exists yet", async () => {
    renderAt();

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText(/PAT-000001/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start consultation/i })).toBeInTheDocument();
  });

  it("records temperature with the vitals and shows it in the reading", async () => {
    mockedRecordVitals.mockResolvedValueOnce({
      id: "vital-1",
      temperature_celsius: "39.1",
      blood_pressure_systolic: null,
      blood_pressure_diastolic: null,
      pulse_bpm: 98,
      respiratory_rate: null,
      spo2_percent: null,
      weight_kg: null,
      height_cm: null,
      bmi: null,
      notes: "",
      recorded_by_name: "Nurse Efua",
      created_at: "",
    });
    renderAt();

    await userEvent.type(await screen.findByLabelText(/temperature/i), "39.1");
    await userEvent.type(screen.getByLabelText(/pulse/i), "98");
    await userEvent.click(screen.getByRole("button", { name: /record vitals/i }));

    await waitFor(() =>
      expect(mockedRecordVitals).toHaveBeenCalledWith(
        "visit-1",
        expect.objectContaining({ temperature_celsius: "39.1", pulse_bpm: 98 }),
      ),
    );
    expect(await screen.findByText(/Temp 39\.1 °C · Pulse 98 bpm/)).toBeInTheDocument();
  });

  it("explains a 403 when the signed-in role cannot record vitals", async () => {
    mockedRecordVitals.mockRejectedValueOnce(forbiddenError());
    renderAt();

    await userEvent.type(await screen.findByLabelText(/temperature/i), "37.0");
    await userEvent.click(screen.getByRole("button", { name: /record vitals/i }));

    expect(await screen.findByText(/does not have vitals\.create/i)).toBeInTheDocument();
  });

  it("starting a consultation reveals the notes form and diagnosis section", async () => {
    mockedStartConsultation.mockResolvedValueOnce({
      id: "consult-1",
      doctor: "doctor-1",
      doctor_name: "Dr. Owusu",
      chief_complaint: "",
      symptoms: "",
      clinical_notes: "",
      treatment_plan: "",
      follow_up_instructions: "",
      follow_up_date: null,
      status: "in_progress",
      completed_at: null,
      diagnoses: [],
      created_at: "",
      updated_at: "",
    });

    renderAt();
    await userEvent.click(await screen.findByRole("button", { name: /start consultation/i }));

    await waitFor(() => expect(mockedStartConsultation).toHaveBeenCalledWith("visit-1"));
    expect(await screen.findByText(/diagnoses/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete consultation/i })).toBeDisabled();
  });

  it("adding a diagnosis enables completing the consultation", async () => {
    mockedGetConsultation.mockResolvedValue({
      id: "consult-1",
      doctor: "doctor-1",
      doctor_name: "Dr. Owusu",
      chief_complaint: "Fever",
      symptoms: "",
      clinical_notes: "",
      treatment_plan: "",
      follow_up_instructions: "",
      follow_up_date: null,
      status: "in_progress",
      completed_at: null,
      diagnoses: [],
      created_at: "",
      updated_at: "",
    });
    mockedAddDiagnosis.mockResolvedValueOnce({
      id: "diag-1",
      condition: "Malaria",
      diagnosis_type: "primary",
      notes: "",
      diagnosed_by_name: "Dr. Owusu",
      created_at: "",
    });

    renderAt();
    await screen.findByRole("button", { name: /complete consultation/i });

    await userEvent.type(screen.getByLabelText(/condition/i), "Malaria");
    await userEvent.click(screen.getByRole("button", { name: /add diagnosis/i }));

    await waitFor(() => expect(mockedAddDiagnosis).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /complete consultation/i })).toBeEnabled();
  });

  it("still renders the visit for a role denied vitals/consultation (e.g. Receptionist) instead of failing the whole page", async () => {
    mockedListVitals.mockReset().mockRejectedValue(forbiddenError());
    mockedGetConsultation.mockReset().mockRejectedValue(forbiddenError());

    renderAt();

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.queryByText(/could not load this visit/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/^vitals$/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/^consultation$/i)).not.toBeInTheDocument();
  });

  it("shows Referrals even when consultation access is denied, so a role like Receptionist can still reach it", async () => {
    mockedGetConsultation.mockReset().mockRejectedValue(forbiddenError());

    renderAt();

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText(/^referrals$/i)).toBeInTheDocument();
    expect(screen.getByText(/no referrals made yet/i)).toBeInTheDocument();
  });
});
