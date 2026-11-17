"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthCard, takeFragmentToken } from "@/components/auth/AuthCard";
import { api } from "@/lib/api";
import styles from "../account.module.css";

type State = { status: "working" } | { status: "done" } | { status: "error"; message: string };

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>({ status: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = takeFragmentToken();
    const run = token
      ? api("/api/auth/verify-email", { body: { token } }).then(() => ({ status: "done" }) as State)
      : Promise.resolve({ status: "error", message: "El enlace está incompleto. Ábrelo de nuevo desde el correo." } as State);
    run.catch((e: unknown) => ({ status: "error", message: e instanceof Error ? e.message : "No se pudo confirmar el correo." }) as State).then(setState);
  }, []);

  return (
    <AuthCard title="Confirmar correo">
      {state.status === "working" && <p className={styles.note} role="status">Confirmando tu correo…</p>}
      {state.status === "done" && (
        <div className={styles.form}>
          <p className={styles.success} role="status">Tu correo quedó confirmado.</p>
          <Link className={`${styles.primaryButton} ${styles.authButton}`} href="/login">Iniciar sesión</Link>
        </div>
      )}
      {state.status === "error" && (
        <div className={styles.form}>
          <p className={styles.error} role="alert">{state.message}</p>
          <Link className={styles.textLink} href="/login">Ir a iniciar sesión</Link>
        </div>
      )}
    </AuthCard>
  );
}
