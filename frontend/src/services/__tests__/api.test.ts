import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  getRefreshToken,
  refreshSession,
  setAccessToken,
  setRefreshToken,
  setSessionExpiredHandler,
} from "../api";

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
    status: 401,
    statusText: "Unauthorized",
    data: { code: "token_not_valid" },
    headers: {},
    config,
  });
}

// A fake API: only requests carrying the fresh token succeed; anything else is a 401.
const acceptsOnlyFreshToken: AxiosAdapter = async (config) => {
  if (config.headers.Authorization !== "Bearer fresh-access") throw unauthorized(config);
  return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
};

describe("session renewal", () => {
  const expired = vi.fn();
  let refreshPost: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    expired.mockReset();
    setSessionExpiredHandler(expired);
    setAccessToken("expired-access");
    setRefreshToken("refresh-1");
    api.defaults.adapter = acceptsOnlyFreshToken;
    refreshPost = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { access: "fresh-access", refresh: "refresh-2" } } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setSessionExpiredHandler(null);
    setAccessToken(null);
    localStorage.clear();
  });

  it("renews an expired access token on a 401 and replays the request", async () => {
    const response = await api.get("/patients/");

    expect(response.data).toEqual({ ok: true });
    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(refreshPost.mock.calls[0][1]).toEqual({ refresh: "refresh-1" });
    expect(expired).not.toHaveBeenCalled();
  });

  it("stores the rotated refresh token, since the old one is blacklisted after use", async () => {
    await api.get("/patients/");

    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("shares one refresh between simultaneous 401s", async () => {
    await Promise.all([api.get("/patients/"), api.get("/queue/"), api.get("/appointments/")]);

    expect(refreshPost).toHaveBeenCalledTimes(1);
  });

  it("shares one refresh between concurrent callers of refreshSession", async () => {
    await Promise.all([refreshSession(), refreshSession()]);

    expect(refreshPost).toHaveBeenCalledTimes(1);
  });

  it("ends the session when the refresh token is no longer valid", async () => {
    refreshPost.mockRejectedValue(new Error("refresh rejected"));

    await expect(api.get("/patients/")).rejects.toMatchObject({ response: { status: 401 } });

    expect(expired).toHaveBeenCalledTimes(1);
    expect(getRefreshToken()).toBeNull();
  });

  it("does not try to renew when a login attempt itself returns 401", async () => {
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.post("/auth/token/", {})).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshPost).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });

  it("replays a request only once, so a genuinely unauthorised call cannot loop", async () => {
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.get("/patients/")).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshPost).toHaveBeenCalledTimes(1);
  });
});
