"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createLocalAccount,
  changeLocalPassword,
  deleteLocalAccount,
  getLocalUser,
  signInLocalAccount,
  signOutLocalAccount,
  updateLocalUser,
  type LocalUser,
} from "@/lib/auth/local";

type AuthContextValue = {
  user: LocalUser | null;
  ready: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateProfile: (name: string, email: string) => void;
  deleteAccount: () => void;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getLocalUser());
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === "lpg:active-account" || event.key === "lpg:accounts") setUser(getLocalUser());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    async register(name, email, password) {
      setUser(await createLocalAccount(name, email, password));
    },
    async signIn(email, password) {
      setUser(await signInLocalAccount(email, password));
    },
    signOut() {
      signOutLocalAccount();
      setUser(null);
    },
    updateProfile(name, email) {
      if (!user) return;
      setUser(updateLocalUser({ ...user, name, email }));
    },
    async changePassword(currentPassword, nextPassword) {
      if (!user) throw new Error("Inicia sesión para cambiar tu contraseña.");
      await changeLocalPassword(user.id, currentPassword, nextPassword);
    },
    deleteAccount() {
      if (!user) return;
      deleteLocalAccount(user.id);
      setUser(null);
    },
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
