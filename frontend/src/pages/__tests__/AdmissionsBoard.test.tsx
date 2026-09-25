import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admissionsService from "../../services/admissions";
import { AdmissionsBoard } from "../AdmissionsBoard";

vi.mock("../../services/admissions");

const mockedListAdmissions = vi.mocked(admissionsService.listAdmissions);

const admission = {
  id: "admission-1",
  patient: "patient-1",
  patient_name: "Ama Mensah",
  visit: "visit-1",
  bed: 1,
  bed_label: "Male Ward — 101 — Bed A",
  reason: "Severe malaria",
  status: "admitted" as const,
  admitted_by_name: "Dr. Owusu",
  discharge: null,
  created_at: "",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <AdmissionsBoard />
    </MemoryRouter>,
  );
}

describe("AdmissionsBoard", () => {
  beforeEach(() => {
    mockedListAdmissions.mockReset().mockResolvedValue([admission]);
  });

  it("lists currently admitted patients with their bed", async () => {
    renderPage();

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("Male Ward — 101 — Bed A")).toBeInTheDocument();
    expect(mockedListAdmissions).toHaveBeenCalledWith("admitted");
  });

  it("shows an empty state when no one is admitted", async () => {
    mockedListAdmissions.mockReset().mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no one is currently admitted/i)).toBeInTheDocument();
  });

  it("links to the manage wards & beds page", async () => {
    renderPage();

    expect(await screen.findByRole("link", { name: /manage wards.*beds/i })).toHaveAttribute(
      "href",
      "/admissions/beds",
    );
  });
});
