import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as AuthContextModule from "../../context/AuthContext";
import type { CurrentUser } from "../../types/auth";
import { AppLayout } from "../AppLayout";

vi.mock("../../context/AuthContext", async () => {
  const actual = await vi.importActual("../../context/AuthContext");
  return { ...actual, useAuth: vi.fn() };
});

const mockedUseAuth = vi.mocked(AuthContextModule.useAuth);

function userWith(permissions: CurrentUser["permissions"]): CurrentUser {
  return {
    id: "u-1",
    email: "someone@demo.hms.gh",
    first_name: "Someone",
    last_name: "",
    phone: "",
    hospital: "hosp-1",
    role: { id: 1, name: "pharmacist", description: "Pharmacist" },
    is_active: true,
    permissions,
  };
}

function renderLayout(user: CurrentUser) {
  mockedUseAuth.mockReturnValue({ user, initializing: false, login: vi.fn(), logout: vi.fn() });
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout nav", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it("always shows Dashboard, and only shows modules the role can view", () => {
    renderLayout(userWith({ pharmacy: ["view", "create"], inventory: ["view", "edit"] }));

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pharmacy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /inventory/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /referrals/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admissions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /patients/i })).not.toBeInTheDocument();
  });

  it("shows no module nav items at all for a role with no grants", () => {
    renderLayout(userWith({}));

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /patients/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /referrals/i })).not.toBeInTheDocument();
  });
});
