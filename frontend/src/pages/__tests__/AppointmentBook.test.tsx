import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as appointmentsService from "../../services/appointments";
import * as patientsService from "../../services/patients";
import { AppointmentBook } from "../AppointmentBook";

vi.mock("../../services/appointments");
vi.mock("../../services/patients");

const mockedListDepartments = vi.mocked(appointmentsService.listDepartments);
const mockedCreateAppointment = vi.mocked(appointmentsService.createAppointment);
const mockedGetPatient = vi.mocked(patientsService.getPatient);

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
        <Route path="/appointments/book" element={<AppointmentBook />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppointmentBook", () => {
  beforeEach(() => {
    mockedListDepartments.mockReset().mockResolvedValue([department]);
    mockedCreateAppointment.mockReset();
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
    renderAt("/appointments/book");

    expect(screen.getByText(/pick a patient first/i)).toBeInTheDocument();
  });

  it("requires a department before booking", async () => {
    renderAt("/appointments/book?patient=patient-1");

    await screen.findByRole("option", { name: department.name });
    await userEvent.click(screen.getByRole("button", { name: /book appointment/i }));

    expect(await screen.findByText(/select a department/i)).toBeInTheDocument();
    expect(mockedCreateAppointment).not.toHaveBeenCalled();
  });

  it("books the appointment with the patient id from the URL", async () => {
    mockedCreateAppointment.mockResolvedValueOnce({
      id: "appt-1",
      patient: "patient-1",
      patient_name: "Ama Mensah",
      department: department.id,
      department_name: department.name,
      doctor: null,
      doctor_name: null,
      scheduled_at: "2030-01-01T10:00:00Z",
      duration_minutes: 30,
      status: "scheduled",
      reason: "",
      notes: "",
      created_at: "",
    });

    renderAt("/appointments/book?patient=patient-1");

    await screen.findByRole("option", { name: department.name });
    await userEvent.selectOptions(screen.getByLabelText(/department/i), department.id);
    await userEvent.type(screen.getByLabelText(/date and time/i), "2030-01-01T10:00");
    await userEvent.click(screen.getByRole("button", { name: /book appointment/i }));

    await waitFor(() => expect(mockedCreateAppointment).toHaveBeenCalledTimes(1));
    const submitted = mockedCreateAppointment.mock.calls[0][0];
    expect(submitted.patient).toBe("patient-1");
    expect(submitted.department).toBe(department.id);
  });
});
