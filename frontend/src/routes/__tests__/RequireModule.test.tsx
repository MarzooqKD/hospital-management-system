import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as AuthContextModule from "../../context/AuthContext";
import type { CurrentUser } from "../../types/auth";
import { RequireModule } from "../RequireModule";

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
    role: { id: 1, name: "receptionist", description: "Receptionist" },
    is_active: true,
    permissions,
  };
}

describe("RequireModule", () => {
  it("renders its children when the role holds <module>.view", () => {
    mockedUseAuth.mockReturnValue({
      user: userWith({ referrals: ["view"] }),
      initializing: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <RequireModule module="referrals">
        <div>Referrals board</div>
      </RequireModule>,
    );

    expect(screen.getByText("Referrals board")).toBeInTheDocument();
  });

  it("shows an access-restricted message instead of the page when the grant is missing", () => {
    mockedUseAuth.mockReturnValue({
      user: userWith({ referrals: ["view"] }),
      initializing: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <RequireModule module="admissions">
        <div>Admissions board</div>
      </RequireModule>,
    );

    expect(screen.queryByText("Admissions board")).not.toBeInTheDocument();
    expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
  });
});
