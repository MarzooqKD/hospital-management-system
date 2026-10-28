import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getRefreshToken,
  refreshSession,
  setAccessToken,
  setRefreshToken,
  setSessionExpiredHandler,
} from "../services/api";
import * as authService from "../services/auth";
import type { CurrentUser } from "../types/auth";

interface AuthContextValue {
  user: CurrentUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    if (!getRefreshToken()) {
      setInitializing(false);
      return;
    }

    refreshSession()
      .then(() => authService.fetchCurrentUser())
      .then(setUser)
      .catch(() => setAccessToken(null))
      .finally(() => setInitializing(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authService.login(email, password);
    setRefreshToken(tokens.refresh);
    setAccessToken(tokens.access);
    const currentUser = await authService.fetchCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  const logout = useCallback(async () => {
    const storedRefresh = getRefreshToken();
    if (storedRefresh) {
      await authService.logout(storedRefresh).catch(() => {
        // Already invalid/expired — still proceed to clear local state.
      });
    }
    setRefreshToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, logout }),
    [user, initializing, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
