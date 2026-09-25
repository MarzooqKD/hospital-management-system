import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as AuthContextModule from "../../context/AuthContext";
import type { CurrentUser } from "../../types/auth";
import { Login } from "../Login";

vi.mock("../../context/AuthContext", async () => {
  const actual = await vi.importActual("../../context/AuthContext");
  return { ...actual, useAuth: vi.fn() };
});

const mockedUseAuth = vi.mocked(AuthContextModule.useAuth);

function accountWithRole(roleName: string): CurrentUser {
  return {
    id: "u-1",
    email: "doctor@demo.hms.gh",
    first_name: "Demo",
    last_name: "",
    phone: "",
    hospital: "hosp-1",
    is_active: true,
    permissions: {},
    role: { id: 1, name: roleName, description: roleName },
  };
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

async function fillCredentials(role: string) {
  await userEvent.selectOptions(screen.getByLabelText(/role/i), role);
  await userEvent.type(screen.getByLabelText(/email/i), "doctor@demo.hms.gh");
  await userEvent.type(screen.getByLabelText(/password/i), "DemoPass123!");
}

describe("Login", () => {
  const loginMock = vi.fn();
  const logoutMock = vi.fn();

  beforeEach(() => {
    loginMock.mockReset();
    logoutMock.mockReset();
    mockedUseAuth.mockReturnValue({
      user: null,
      initializing: false,
      login: loginMock,
      logout: logoutMock,
    });
  });

  it("shows validation errors and does not call login when submitted empty", async () => {
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/^select your role$/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("calls login with the entered credentials and signs in when the role matches", async () => {
    loginMock.mockResolvedValueOnce(accountWithRole("doctor"));
    renderLogin();

    await fillCredentials("doctor");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith("doctor@demo.hms.gh", "DemoPass123!"),
    );
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("shows an error message when the backend rejects the credentials", async () => {
    loginMock.mockRejectedValueOnce(new Error("Request failed with status code 401"));
    renderLogin();

    await fillCredentials("doctor");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
  });

  it("signs the account back out and warns when the selected role doesn't match the account", async () => {
    loginMock.mockResolvedValueOnce(accountWithRole("doctor"));
    renderLogin();

    await fillCredentials("nurse");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/isn't registered as nurse/i)).toBeInTheDocument();
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
