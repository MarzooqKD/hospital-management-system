import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as patientsService from "../../services/patients";
import { PatientList } from "../PatientList";

vi.mock("../../services/patients");

const mockedListPatients = vi.mocked(patientsService.listPatients);

const patient = {
  id: "patient-1",
  patient_number: "PAT-000001",
  first_name: "Ama",
  last_name: "Mensah",
  date_of_birth: "1990-05-12",
  gender: "female" as const,
  phone: "+233241234567",
  is_active: true,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientList />
    </MemoryRouter>,
  );
}

describe("PatientList", () => {
  beforeEach(() => {
    mockedListPatients
      .mockReset()
      .mockResolvedValue({ count: 1, next: null, previous: null, results: [patient] });
  });

  it("lists active patients by default, excluding deleted ones", async () => {
    renderPage();

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    await waitFor(() => expect(mockedListPatients).toHaveBeenLastCalledWith("", false));
  });

  it("passes include-deleted through to the service when the toggle is checked", async () => {
    renderPage();
    await screen.findByText("Ama Mensah");

    await userEvent.click(screen.getByLabelText(/show deleted patients/i));

    await waitFor(() => expect(mockedListPatients).toHaveBeenLastCalledWith("", true));
  });

  it("shows a Deleted badge for an inactive patient", async () => {
    mockedListPatients.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...patient, is_active: false }],
    });
    renderPage();

    expect(await screen.findByText("Deleted")).toBeInTheDocument();
  });
});
