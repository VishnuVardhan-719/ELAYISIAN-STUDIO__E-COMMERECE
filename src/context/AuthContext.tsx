import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService, SESSION_KEY } from "../services/api";
import type { User } from "../types/domain";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* The session simply will not survive a reload. */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    authService
      .me(readToken())
      .then((restored) => {
        if (active) setUser(restored);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    writeToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const result = await authService.register(input);
      writeToken(result.token);
      setUser(result.user);
      return result.user;
    },
    [],
  );

  const logout = useCallback(() => {
    writeToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}

export const HOME_BY_ROLE: Record<User["role"], string> = {
  customer: "/account",
  creator: "/creator-dashboard",
  admin: "/admin",
};
