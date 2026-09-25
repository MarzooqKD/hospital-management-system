import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as admissionsService from "../../services/admissions";
import * as appointmentsService from "../../services/appointments";
import { ManageBeds } from "../ManageBeds";

vi.mock("../../services/admissions");
vi.mock("../../services/appointments");

const mockedListWards = vi.mocked(admissionsService.listWards);
const mockedCreateWard = vi.mocked(admissionsService.createWard);
const mockedListRooms = vi.mocked(admissionsService.listRooms);
const mockedCreateRoom = vi.mocked(admissionsService.createRoom);
const mockedListAllBeds = vi.mocked(admissionsService.listAllBeds);
const mockedCreateBed = vi.mocked(admissionsService.createBed);
const mockedListDepartments = vi.mocked(appointmentsService.listDepartments);

const ward = { id: 1, name: "Male Ward", department: null, is_active: true };
const room = { id: 1, ward: 1, ward_name: "Male Ward", name: "101", is_active: true };
const bed = {
  id: 1,
  room: 1,
  room_name: "101",
  ward_name: "Male Ward",
  label: "A",
  is_occupied: false,
  is_active: true,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ManageBeds />
    </MemoryRouter>,
  );
}

describe("ManageBeds", () => {
  beforeEach(() => {
    mockedListWards.mockReset().mockResolvedValue([ward]);
    mockedListRooms.mockReset().mockResolvedValue([room]);
    mockedListAllBeds.mockReset().mockResolvedValue([bed]);
    mockedListDepartments.mockReset().mockResolvedValue([]);
    mockedCreateWard.mockReset();
    mockedCreateRoom.mockReset();
    mockedCreateBed.mockReset();
  });

  it("lists existing wards, rooms, and beds", async () => {
    renderPage();

    expect(await screen.findByText("Male Ward")).toBeInTheDocument();
    expect(screen.getByText("Male Ward — 101")).toBeInTheDocument();
    expect(screen.getByText(/Male Ward — 101 — Bed A/)).toBeInTheDocument();
    expect(screen.getByText(/available/i)).toBeInTheDocument();
  });

  it("creates a new ward", async () => {
    mockedCreateWard.mockResolvedValueOnce({ id: 2, name: "Female Ward", department: null, is_active: true });
    renderPage();
    await screen.findByText("Male Ward");

    await userEvent.click(screen.getByRole("button", { name: /new ward/i }));
    await userEvent.type(screen.getByLabelText(/ward name/i), "Female Ward");
    await userEvent.click(screen.getByRole("button", { name: /create ward/i }));

    await waitFor(() =>
      expect(mockedCreateWard).toHaveBeenCalledWith({ name: "Female Ward", department: undefined }),
    );
  });

  it("creates a new bed against an existing room", async () => {
    mockedCreateBed.mockResolvedValueOnce({ ...bed, id: 2, label: "B" });
    renderPage();
    await screen.findByText(/Bed A/);

    await userEvent.click(screen.getByRole("button", { name: /new bed/i }));
    await userEvent.selectOptions(screen.getByLabelText(/room/i), "1");
    await userEvent.type(screen.getByLabelText(/bed label/i), "B");
    await userEvent.click(screen.getByRole("button", { name: /create bed/i }));

    await waitFor(() =>
      expect(mockedCreateBed).toHaveBeenCalledWith({ room: 1, label: "B" }),
    );
  });

  it("shows a hint instead of a form when there are no wards yet to attach a room to", async () => {
    mockedListWards.mockReset().mockResolvedValue([]);
    mockedListRooms.mockReset().mockResolvedValue([]);
    mockedListAllBeds.mockReset().mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/create a ward first/i)).toBeInTheDocument();
    expect(screen.getByText(/create a room first/i)).toBeInTheDocument();
  });
});
