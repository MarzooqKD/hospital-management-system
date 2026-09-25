import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as consultationsService from "../../services/consultations";
import * as patientsService from "../../services/patients";
import type { Patient } from "../../types/patient";
import { PatientDetail } from "../PatientDetail";

vi.mock("../../services/patients");
vi.mock("../../services/consultations");

const mockedGetPatient = vi.mocked(patientsService.getPatient);
const mockedListInsurance = vi.mocked(patientsService.listInsurance);
const mockedListAllergies = vi.mocked(patientsService.listAllergies);
const mockedSetPatientActive = vi.mocked(patientsService.setPatientActive);
const mockedListMedicalRecords = vi.mocked(consultationsService.listMedicalRecords);

const basePatient: Patient = {
  id: "patient-1",
  patient_number: "PAT-000001",
  first_name: "Ama",
  last_name: "Mensah",
  date_of_birth: "1990-05-12",
  gender: "female",
  phone: "+233241234567",
  is_active: true,
  ghana_card_number: "",
  nhis_number: "",
  alt_phone: "",
  email: "",
  address_region: "",
  address_district: "",
  address_town: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  blood_group: "unknown",
  created_at: "",
  updated_at: "",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/patients/patient-1"]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PatientDetail — delete/restore", () => {
  beforeEach(() => {
    mockedGetPatient.mockReset().mockResolvedValue(basePatient);
    mockedListInsurance.mockReset().mockResolvedValue([]);
    mockedListAllergies.mockReset().mockResolvedValue([]);
    mockedListMedicalRecords.mockReset().mockResolvedValue([]);
    mockedSetPatientActive.mockReset();
  });

  it("shows an active patient with a Delete action", async () => {
    renderPage();

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("deletes (deactivates) the patient after confirming in the modal", async () => {
    mockedSetPatientActive.mockResolvedValueOnce({ ...basePatient, is_active: false });
    renderPage();
    await screen.findByText("Ama Mensah");

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete patient/i });

    await userEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(mockedSetPatientActive).toHaveBeenCalledWith("patient-1", false),
    );
    expect(await screen.findByText("Deleted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^restore$/i })).toBeInTheDocument();
  });

  it("cancelling the modal does not call the API", async () => {
    renderPage();
    await screen.findByText("Ama Mensah");

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockedSetPatientActive).not.toHaveBeenCalled();
  });

  it("restores a previously deleted patient", async () => {
    mockedGetPatient.mockReset().mockResolvedValue({ ...basePatient, is_active: false });
    mockedSetPatientActive.mockResolvedValueOnce({ ...basePatient, is_active: true });
    renderPage();
    await screen.findByText("Ama Mensah");

    expect(screen.getByText("Deleted")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^restore$/i }));
    const dialog = screen.getByRole("dialog", { name: /restore patient/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /^restore$/i }));

    await waitFor(() =>
      expect(mockedSetPatientActive).toHaveBeenCalledWith("patient-1", true),
    );
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("shows a 403 message if the role lacks patients.edit", async () => {
    mockedSetPatientActive.mockReset().mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { isAxiosError: true, response: { status: 403 } }),
    );
    renderPage();
    await screen.findByText("Ama Mensah");

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete patient/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText(/403 forbidden/i)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
