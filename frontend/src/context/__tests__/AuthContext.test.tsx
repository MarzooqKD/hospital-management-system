import { render, screen } from "@testing-library/react";
import axios from "axios";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRefreshToken, setAccessToken, setRefreshToken } from "../../services/api";
import * as authService from "../../services/auth";
import type { CurrentUser } from "../../types/auth";
import { AuthProvider, useAuth } from "../AuthContext";

vi.mock("../../services/auth");

const nurse: CurrentUser = {
  id: "u-1",
  email: "nurse@demo.hms.gh",
  first_name: "Nurse",
  last_name: "",
  phone: "",
  hospital: "hosp-1",
  role: { id: 4, name: "nurse", description: "Nurse" },
  is_active: true,
  permissions: {},
};

function Probe() {
  const { user, initializing } = useAuth();
  if (initializing) return <p>loading</p>;
  return <p>{user ? `signed in as ${user.email}` : "signed out"}</p>;
}

describe("AuthProvider startup", () => {
  let refreshPost: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(authService.fetchCurrentUser).mockReset().mockResolvedValue(nurse);
    refreshPost = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { access: "fresh-access", refresh: "refresh-2" } } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
    localStorage.clear();
  });

  it("restores the session from the stored refresh token and keeps the rotated one", async () => {
    setRefreshToken("refresh-1");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText("signed in as nurse@demo.hms.gh")).toBeInTheDocument();
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("refreshes only once even when React runs the startup effect twice (StrictMode)", async () => {
    setRefreshToken("refresh-1");
    render(
      <StrictMode>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </StrictMode>,
    );

    expect(await screen.findByText("signed in as nurse@demo.hms.gh")).toBeInTheDocument();
    expect(refreshPost).toHaveBeenCalledTimes(1);
  });

  it("stays signed out, without calling the API, when there is no stored session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(refreshPost).not.toHaveBeenCalled();
  });

  it("signs out and forgets the token when the stored refresh token is rejected", async () => {
    setRefreshToken("stale");
    refreshPost.mockRejectedValue(new Error("blacklisted"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(getRefreshToken()).toBeNull();
  });
});
