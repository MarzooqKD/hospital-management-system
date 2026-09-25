import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as patientsService from "../../services/patients";
import { PatientRegister } from "../PatientRegister";

vi.mock("../../services/patients");

const mockedCreatePatient = vi.mocked(patientsService.createPatient);

function fillRequiredFields() {
  return async () => {
    await userEvent.type(screen.getByLabelText(/first name/i), "Ama");
    await userEvent.type(screen.getByLabelText(/last name/i), "Mensah");
    await userEvent.type(screen.getByLabelText(/date of birth/i), "1990-05-12");
    await userEvent.type(screen.getByLabelText(/^phone\b/i), "024 123 4567");
  };
}

describe("PatientRegister", () => {
  beforeEach(() => {
    mockedCreatePatient.mockReset();
  });

  it("shows validation errors when required fields are missing", async () => {
    render(
      <MemoryRouter>
        <PatientRegister />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /register patient/i }));

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
    expect(mockedCreatePatient).not.toHaveBeenCalled();
  });

  it("rejects an invalid Ghanaian phone number", async () => {
    render(
      <MemoryRouter>
        <PatientRegister />
      </MemoryRouter>,
    );

    await fillRequiredFields()();
    await userEvent.clear(screen.getByLabelText(/^phone\b/i));
    await userEvent.type(screen.getByLabelText(/^phone\b/i), "12345");
    await userEvent.click(screen.getByRole("button", { name: /register patient/i }));

    expect(await screen.findByText(/valid ghanaian phone number/i)).toBeInTheDocument();
    expect(mockedCreatePatient).not.toHaveBeenCalled();
  });

  it("rejects a malformed Ghana Card number", async () => {
    render(
      <MemoryRouter>
        <PatientRegister />
      </MemoryRouter>,
    );

    await fillRequiredFields()();
    await userEvent.type(screen.getByLabelText(/ghana card number/i), "not-a-card");
    await userEvent.click(screen.getByRole("button", { name: /register patient/i }));

    expect(await screen.findByText(/GHA-XXXXXXXXX-X/i)).toBeInTheDocument();
    expect(mockedCreatePatient).not.toHaveBeenCalled();
  });

  it("submits successfully with valid data", async () => {
    mockedCreatePatient.mockResolvedValueOnce({
      id: "p-1",
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

    render(
      <MemoryRouter>
        <PatientRegister />
      </MemoryRouter>,
    );

    await fillRequiredFields()();
    await userEvent.click(screen.getByRole("button", { name: /register patient/i }));

    await waitFor(() => expect(mockedCreatePatient).toHaveBeenCalledTimes(1));
    const submitted = mockedCreatePatient.mock.calls[0][0];
    expect(submitted.first_name).toBe("Ama");
    expect(submitted.phone).toBe("024 123 4567");
  });
});
