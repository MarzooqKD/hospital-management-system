import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as AuthContextModule from "../../context/AuthContext";
import * as admissionsService from "../../services/admissions";
import * as appointmentsService from "../../services/appointments";
import * as authService from "../../services/auth";
import * as inventoryService from "../../services/inventory";
import * as patientsService from "../../services/patients";
import * as queueService from "../../services/queue";
import type { CurrentUser } from "../../types/auth";
import { Dashboard } from "../Dashboard";

vi.mock("../../context/AuthContext", async () => {
  const actual = await vi.importActual("../../context/AuthContext");
  return { ...actual, useAuth: vi.fn() };
});
vi.mock("../../services/auth");
vi.mock("../../services/patients");
vi.mock("../../services/appointments");
vi.mock("../../services/queue");
vi.mock("../../services/inventory");
vi.mock("../../services/admissions");

const mockedUseAuth = vi.mocked(AuthContextModule.useAuth);
const mockedFetchAllUsers = vi.mocked(authService.fetchAllUsers);
const mockedListPatients = vi.mocked(patientsService.listPatients);
const mockedListAppointments = vi.mocked(appointmentsService.listAppointments);
const mockedListQueue = vi.mocked(queueService.listQueue);
const mockedListInventoryItems = vi.mocked(inventoryService.listInventoryItems);
const mockedGetBedOccupancySummary = vi.mocked(admissionsService.getBedOccupancySummary);

const receptionist: CurrentUser = {
  id: "u-1",
  email: "reception@demo.hms.gh",
  first_name: "Receptionist",
  last_name: "",
  phone: "",
  hospital: "hosp-1",
  role: { id: 5, name: "receptionist", description: "Receptionist" },
  is_active: true,
  permissions: {
    patients: ["view", "create", "edit"],
    appointments: ["view", "create", "edit", "delete"],
    queue: ["view", "create", "edit"],
    admissions: ["view"],
    referrals: ["view"],
  },
};

function forbiddenError() {
  return Object.assign(new Error("Forbidden"), {
    isAxiosError: true,
    response: { status: 403 },
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: receptionist,
      initializing: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockedFetchAllUsers.mockReset();
    mockedListPatients.mockReset().mockResolvedValue({ count: 12, next: null, previous: null, results: [] });
    mockedListAppointments.mockReset().mockResolvedValue([]);
    mockedListQueue.mockReset().mockResolvedValue([]);
    mockedListInventoryItems.mockReset().mockRejectedValue(forbiddenError());
    mockedGetBedOccupancySummary.mockReset().mockResolvedValue({ total: 260, occupied: 212 });
  });

  it("shows the signed-in user's own profile", () => {
    renderDashboard();

    expect(screen.getByText(receptionist.email)).toBeInTheDocument();
  });

  it("shows a live patient count and hides cards the role can't access", async () => {
    renderDashboard();

    expect(await screen.findByText("12")).toBeInTheDocument();
    // Receptionist has no inventory.view grant — the low-stock card
    // shouldn't render at all, not show a broken/zero value.
    expect(screen.queryByText(/low stock/i)).not.toBeInTheDocument();
  });

  it("shows real bed occupancy computed from the beds endpoint", async () => {
    renderDashboard();

    expect(await screen.findByText("212 / 260")).toBeInTheDocument();
    expect(screen.getByText("82% occupancy")).toBeInTheDocument();
  });

  it("hides the beds card when the role has no admissions.view grant", async () => {
    mockedGetBedOccupancySummary.mockReset().mockRejectedValue(forbiddenError());
    renderDashboard();

    await screen.findByText("12");
    expect(screen.queryByText(/beds occupied/i)).not.toBeInTheDocument();
  });

  it("shows the RBAC deny message when the users list returns 403", async () => {
    mockedFetchAllUsers.mockRejectedValueOnce(forbiddenError());
    renderDashboard();

    await userEvent.click(screen.getByRole("button", { name: /view all staff accounts/i }));

    expect(await screen.findByText(/403 forbidden/i)).toBeInTheDocument();
  });

  it("shows the staff list when the request is allowed", async () => {
    mockedFetchAllUsers.mockResolvedValueOnce([receptionist]);
    renderDashboard();

    await userEvent.click(screen.getByRole("button", { name: /view all staff accounts/i }));

    const list = await screen.findByRole("list");
    expect(within(list).getByText(/reception@demo\.hms\.gh/)).toBeInTheDocument();
  });
});
