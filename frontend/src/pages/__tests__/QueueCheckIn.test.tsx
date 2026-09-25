import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as appointmentsService from "../../services/appointments";
import * as patientsService from "../../services/patients";
import * as queueService from "../../services/queue";
import { QueueCheckIn } from "../QueueCheckIn";

vi.mock("../../services/appointments");
vi.mock("../../services/patients");
vi.mock("../../services/queue");

const mockedListDepartments = vi.mocked(appointmentsService.listDepartments);
const mockedGetPatient = vi.mocked(patientsService.getPatient);
const mockedCheckIn = vi.mocked(queueService.checkIn);

const department = {
  id: "dept-1",
  name: "General Outpatient",
  code: "",
  description: "",
  is_active: true,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/queue/check-in" element={<QueueCheckIn />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QueueCheckIn", () => {
  beforeEach(() => {
    mockedListDepartments.mockReset().mockResolvedValue([department]);
    mockedCheckIn.mockReset();
    mockedGetPatient.mockReset().mockResolvedValue({
      id: "patient-1",
      patient_number: "PAT-000001",
      first_name: "Ama",
      last_name: "Mensah",
      date_of_birth: "1990-05-12",
      gender: "female",
      phone: "+233241234567",
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
      is_active: true,
      created_at: "",
      updated_at: "",
    });
  });

  it("prompts to pick a patient first when no patient is in the URL", () => {
    renderAt("/queue/check-in");

    expect(screen.getByText(/pick a patient first/i)).toBeInTheDocument();
  });

  it("requires a department before checking in", async () => {
    renderAt("/queue/check-in?patient=patient-1");

    await screen.findByRole("option", { name: department.name });
    await userEvent.click(screen.getByRole("button", { name: /^check in$/i }));

    expect(await screen.findByText(/department is required/i)).toBeInTheDocument();
    expect(mockedCheckIn).not.toHaveBeenCalled();
  });

  it("checks in the patient from the URL with the chosen department and priority", async () => {
    mockedCheckIn.mockResolvedValueOnce({
      id: "queue-1",
      visit_id: "visit-1",
      patient_id: "patient-1",
      patient_name: "Ama Mensah",
      patient_number: "PAT-000001",
      department_name: department.name,
      doctor: null,
      doctor_name: null,
      queue_number: 1,
      priority: "emergency",
      status: "waiting",
      called_at: null,
      completed_at: null,
      created_at: "",
    });

    renderAt("/queue/check-in?patient=patient-1");

    await screen.findByRole("option", { name: department.name });
    await userEvent.selectOptions(screen.getByLabelText(/department/i), department.id);
    await userEvent.selectOptions(screen.getByLabelText(/priority/i), "emergency");
    await userEvent.click(screen.getByRole("button", { name: /^check in$/i }));

    await waitFor(() => expect(mockedCheckIn).toHaveBeenCalledTimes(1));
    expect(mockedCheckIn).toHaveBeenCalledWith({
      patient: "patient-1",
      department: department.id,
      priority: "emergency",
    });
  });
});
