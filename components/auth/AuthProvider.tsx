"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, refreshSession, SESSION_ENDED_EVENT } from "@/lib/api";
import { importGuestProjects, setSignedIn } from "@/lib/store";

/**
 * Accounts live on the server (HttpOnly cookies, 15-minute access token,
 * rotating refresh token). This provider only keeps the public profile.
 */
export type Role = "usuario" | "analista" | "administrador";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  twoFactor: boolean;
  mustSetupTwoFactor: boolean;
};

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  register: (name: string, email: string, password: string, termsAccepted: boolean) => Promise<void>;
  signIn: (email: string, password: string, code?: string) => Promise<User>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  reload: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
/** While the person is active, the session is renewed at most this often. */
const KEEPALIVE_MS = 5 * 60_000;
const ENDED_KEY = "lia:session-ended";

/** Clears what version 0.1 kept in the browser: credential hashes and lock counters. */
function clearLegacyAccountData() {
  try {
    ["lpg:accounts", "lpg:active-account", "lpg:last-activity", "lpg:session-expired", "lpg:auth-attempts", "lpg:pending-project"]
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage blocked: nothing to clear.
  }
}

export function sessionEndedReason(): string | null {
  try {
    return window.sessionStorage.getItem(ENDED_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const setUser = useCallback((next: User | null) => {
    setSignedIn(Boolean(next));
    setUserState(next);
  }, []);

  const reload = useCallback(async () => {
    try {
      const { user: current } = await api<{ user: User }>("/api/auth/me");
      setUser(current);
      if (!current.mustSetupTwoFactor && !current.mustChangePassword) void importGuestProjects().catch(() => 0);
      return current;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 401) setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    clearLegacyAccountData();
    let active = true;
    api<{ user: User }>("/api/auth/me")
      .then(({ user: current }) => {
        if (!active) return;
        setUser(current);
        if (!current.mustSetupTwoFactor && !current.mustChangePassword) void importGuestProjects().catch(() => 0);
      })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [setUser]);

  // Session over (idle, revoked, suspended): back to sign-in with an explanation.
  useEffect(() => {
    const onEnded = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason ?? "session_ended";
      try { window.sessionStorage.setItem(ENDED_KEY, reason); } catch { /* ignore */ }
      setUser(null);
      router.replace("/login");
    };
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
  }, [router, setUser]);

  // Keep the session alive only while the person is active: an idle session
  // ends on the server after 30 minutes (15 for staff).
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    let last = Date.now();
    const onActivity = () => {
      if (Date.now() - last < KEEPALIVE_MS) return;
      last = Date.now();
      void refreshSession();
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
  }, [signedIn]);

  // Forced steps: staff without two-factor and breached or reset-required passwords.
  useEffect(() => {
    if (user && (user.mustSetupTwoFactor || user.mustChangePassword) && pathname !== "/profile") router.replace("/profile");
  }, [user, pathname, router]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    setUser,
    reload,
    async register(name, email, password, termsAccepted) {
      await api("/api/auth/register", { body: { name, email, password, termsAccepted } });
    },
    async signIn(email, password, code) {
      const { user: next } = await api<{ user: User }>("/api/auth/login", { body: { email, password, ...(code ? { code } : {}) } });
      try { window.sessionStorage.removeItem(ENDED_KEY); } catch { /* ignore */ }
      setUser(next);
      if (!next.mustSetupTwoFactor && !next.mustChangePassword) await importGuestProjects().catch(() => 0);
      return next;
    },
    async signOut() {
      await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      setUser(null);
    },
  }), [user, ready, setUser, reload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
