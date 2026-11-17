"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PrivateShell } from "@/components/app/PrivateShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import styles from "../account.module.css";
import admin from "./admin.module.css";

type Tab = "metricas" | "bitacora" | "usuarios";

type AuditEntry = {
  id: string; ocurrido_en: string; actor_id: string | null; actor_correo: string | null; actor_rol: string | null;
  accion: string; resultado: string; objetivo_tipo: string | null; objetivo_id: string | null; ip_enmascarada: string | null;
  id_solicitud: string | null; detalles: Record<string, unknown>;
};
type UserRow = {
  id: string; nombre: string; correo: string; rol: string; estado: string; suspendido_hasta: string | null; verificado: boolean;
  dos_pasos: boolean; creado_en: string; ultimo_acceso_en: string | null; bloqueado: boolean; sesiones: number; proyectos: number;
};
type UserDetail = {
  user: UserRow;
  lock: { fallos_totales: number; bloqueado_hasta: string | null; requiere_restablecer: boolean; requiere_admin: boolean } | null;
  sanctions: { id: string; tipo: string; motivo: string; hasta: string | null; creada_en: string; levantada_en: string | null }[];
  activity: { ocurrido_en: string; accion: string; resultado: string; ip_enmascarada: string | null }[];
  deletedProjects: { id: string; nombre: string | null; eliminado_en: string }[];
};

const date = (value: string | null) => value ? new Date(value).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

const LABELS: Record<string, string> = {
  cuentas_activas: "Cuentas activas",
  cuentas_suspendidas: "Cuentas suspendidas",
  personal_sin_dos_pasos: "Personal sin dos pasos",
  sesiones_activas: "Sesiones activas",
  inicios_fallidos_24h: "Inicios fallidos (24 h)",
  inicios_fallidos_5min: "Inicios fallidos (5 min)",
  bloqueos_10min: "Bloqueos (10 min)",
  cuentas_bloqueadas: "Cuentas bloqueadas",
  ips_bloqueadas: "IP bloqueadas",
  prompts_rechazados_24h: "Prompts rechazados (24 h)",
  accesos_denegados_24h: "Accesos denegados (24 h)",
  reuso_tokens_7d: "Reúso de tokens (7 días)",
  proyectos: "Proyectos",
};

export default function AdminPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "administrador";
  const [tab, setTab] = useState<Tab>("metricas");

  useEffect(() => {
    if (ready && user && user.role === "usuario") router.replace("/dashboard");
  }, [ready, user, router]);

  if (!user || user.role === "usuario") return <PrivateShell>{null}</PrivateShell>;

  return (
    <PrivateShell>
      <main className={styles.content}>
        <header className={styles.contentHeader}>
          <div>
            <h1 className={styles.contentTitle}>Administración</h1>
            <p className={styles.muted}>{isAdmin ? "Administrador: gestión de cuentas y revisión de seguridad." : "Analista: acceso de solo lectura a indicadores y bitácora."}</p>
          </div>
        </header>
        <nav className={admin.tabs} aria-label="Secciones de administración">
          <button type="button" aria-pressed={tab === "metricas"} onClick={() => setTab("metricas")}>Indicadores</button>
          <button type="button" aria-pressed={tab === "bitacora"} onClick={() => setTab("bitacora")}>Bitácora</button>
          {isAdmin && <button type="button" aria-pressed={tab === "usuarios"} onClick={() => setTab("usuarios")}>Usuarios</button>}
        </nav>
        {tab === "metricas" && <Metrics />}
        {tab === "bitacora" && <AuditLog />}
        {tab === "usuarios" && isAdmin && <Users />}
      </main>
    </PrivateShell>
  );
}

function Metrics() {
  const [data, setData] = useState<{ metrics: Record<string, number>; alerts: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ metrics: Record<string, number>; alerts: string[] }>("/api/admin/metrics").then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"));
  }, []);
  if (error) return <p className={styles.error}>{error}</p>;
  if (!data) return <p className={styles.note}>Cargando…</p>;
  return (
    <>
      {data.alerts.map((alert) => <p key={alert} className={styles.notice} role="alert">{alert}</p>)}
      <div className={admin.metrics}>
        {Object.entries(data.metrics).map(([key, value]) => (
          <div key={key} className={admin.metric}><span>{LABELS[key] ?? key}</span><strong>{value}</strong></div>
        ))}
      </div>
    </>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(true);

  const load = useCallback((before?: string) => {
    const params = new URLSearchParams({ accion: action, resultado: result, ...(before ? { antes: before } : {}) });
    return api<{ entries: AuditEntry[] }>(`/api/admin/audit?${params}`).then(({ entries: rows }) => {
      setError(null);
      setEntries((current) => before ? [...current, ...rows] : rows);
      setMore(rows.length === 100);
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"));
  }, [action, result]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section>
      <div className={admin.filters}>
        <input className={styles.input} placeholder="Acción (p. ej. inicio_sesion)" value={action} onChange={(event) => setAction(event.target.value)} />
        <select className={styles.input} value={result} onChange={(event) => setResult(event.target.value)}>
          <option value="">Todos los resultados</option>
          <option value="exito">Éxito</option>
          <option value="fallo">Fallo</option>
          <option value="denegado">Denegado</option>
        </select>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={admin.tableWrap}>
        <table className={admin.table}>
          <thead><tr><th>Fecha</th><th>Acción</th><th>Resultado</th><th>Actor</th><th>Objetivo</th><th>IP</th><th>Detalles</th></tr></thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} data-result={entry.resultado}>
                <td>{date(entry.ocurrido_en)}</td>
                <td>{entry.accion}</td>
                <td>{entry.resultado}</td>
                <td>{entry.actor_correo ?? entry.actor_id ?? "—"}{entry.actor_rol ? ` (${entry.actor_rol})` : ""}</td>
                <td>{entry.objetivo_tipo ? `${entry.objetivo_tipo}: ${entry.objetivo_id}` : "—"}</td>
                <td>{entry.ip_enmascarada ?? "—"}</td>
                <td><code>{Object.keys(entry.detalles ?? {}).length ? JSON.stringify(entry.detalles) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more && entries.length > 0 && <button className={styles.plainButton} type="button" onClick={() => void load(entries.at(-1)?.id)}>Cargar más</button>}
    </section>
  );
}

function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(search)}`)
    .then(({ users: rows }) => setUsers(rows))
    .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error")), [search]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section>
      <div className={admin.filters}>
        <input className={styles.input} placeholder="Buscar por nombre o correo" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={admin.tableWrap}>
        <table className={admin.table}>
          <thead><tr><th>Cuenta</th><th>Rol</th><th>Estado</th><th>Dos pasos</th><th>Sesiones</th><th>Proyectos</th><th>Último acceso</th><th></th></tr></thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.nombre}</strong><br /><span className={styles.note}>{row.correo}{row.verificado ? "" : " · sin verificar"}</span></td>
                <td>{row.rol}</td>
                <td>{row.estado}{row.bloqueado ? " · bloqueada" : ""}{row.suspendido_hasta ? ` hasta ${date(row.suspendido_hasta)}` : ""}</td>
                <td>{row.dos_pasos ? "Sí" : "No"}</td>
                <td>{row.sesiones}</td>
                <td>{row.proyectos}</td>
                <td>{date(row.ultimo_acceso_en)}</td>
                <td><button className={styles.plainButton} type="button" onClick={() => setSelected(row.id)}>Gestionar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <UserPanel id={selected} onClose={() => { setSelected(null); void load(); }} />}
    </section>
  );
}

function UserPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { user: me } = useAuth();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);
  const [role, setRole] = useState("usuario");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<UserDetail>(`/api/admin/users/${encodeURIComponent(id)}`)
    .then((next) => {
      setDetail(next);
      setRole(next.user.rol);
    })
    .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error")), [id]);

  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    setMessage(null);
    try {
      await api(`/api/admin/users/${encodeURIComponent(id)}`, { body });
      setMessage("Acción aplicada y registrada en la bitácora.");
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar.");
    }
  }

  const self = me?.id === id;
  const needsReason = (event: FormEvent, body: Record<string, unknown>, confirmText?: string) => {
    event.preventDefault();
    void act({ ...body, motivo: reason }, confirmText);
  };

  return (
    <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`${styles.modal} ${admin.panel}`} role="dialog" aria-modal="true" aria-label="Gestionar cuenta">
        <div className={styles.modalHeader}>
          <h2 className={styles.sectionTitle}>{detail?.user.nombre ?? "Cuenta"}</h2>
          <button className={styles.plainButton} type="button" onClick={onClose}>Cerrar</button>
        </div>
        {!detail ? <p className={styles.note}>Cargando…</p> : (
          <div className={styles.form}>
            <p className={styles.note}>{detail.user.correo} · {detail.user.rol} · {detail.user.estado} · alta {date(detail.user.creado_en)}</p>
            {self && <p className={styles.notice}>Es tu propia cuenta: otro administrador debe hacer estos cambios.</p>}
            {message && <p className={styles.success}>{message}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}

            {!self && <>
              <label className={styles.field}>Motivo (obligatorio para rol y sanciones)
                <input className={styles.input} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Describe el motivo" />
              </label>

              <form className={admin.row} onSubmit={(event) => needsReason(event, { action: "rol", rol: role }, "¿Cambiar el rol? Se cerrarán sus sesiones.")}>
                <select className={styles.input} value={role} onChange={(event) => setRole(event.target.value)}>
                  <option value="usuario">Usuario</option>
                  <option value="analista">Analista</option>
                  <option value="administrador">Administrador</option>
                </select>
                <button className={styles.plainButton} type="submit" disabled={reason.trim().length < 5}>Cambiar rol</button>
              </form>

              <div className={admin.row}>
                <button className={styles.plainButton} type="button" disabled={reason.trim().length < 5} onClick={() => void act({ action: "advertencia", motivo: reason })}>Advertencia</button>
                <input className={styles.input} type="number" min={1} max={365} value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Días de suspensión" style={{ width: 80 }} />
                <button className={styles.dangerButton} type="button" disabled={reason.trim().length < 5} onClick={() => void act({ action: "suspender", dias: days, motivo: reason }, `¿Suspender ${days} días?`)}>Suspender</button>
                <button className={styles.dangerButton} type="button" disabled={reason.trim().length < 5} onClick={() => void act({ action: "suspender_definitivo", motivo: reason }, "¿Suspender de forma definitiva?")}>Suspensión definitiva</button>
              </div>

              <div className={admin.row}>
                <button className={styles.plainButton} type="button" onClick={() => void act({ action: "levantar_sancion" })}>Levantar suspensión</button>
                <button className={styles.plainButton} type="button" onClick={() => void act({ action: "desbloquear" })}>Desbloquear inicio de sesión</button>
                <button className={styles.plainButton} type="button" onClick={() => void act({ action: "revocar_sesiones" }, "¿Cerrar todas sus sesiones?")}>Revocar sesiones</button>
                <button className={styles.plainButton} type="button" onClick={() => void act({ action: "forzar_cambio_contrasena" }, "¿Obligar a cambiar la contraseña?")}>Forzar cambio de contraseña</button>
              </div>
            </>}

            {detail.lock && <p className={styles.note}>Bloqueo: {detail.lock.requiere_admin ? "requiere administrador" : detail.lock.requiere_restablecer ? "requiere restablecer contraseña" : detail.lock.bloqueado_hasta ? `hasta ${date(detail.lock.bloqueado_hasta)}` : "sin bloqueo"} · {detail.lock.fallos_totales} fallos</p>}

            {detail.deletedProjects.length > 0 && <>
              <h3 className={admin.subtitle}>Proyectos eliminados (recuperables 30 días)</h3>
              {detail.deletedProjects.map((project) => (
                <div key={project.id} className={admin.row}>
                  <span>{project.nombre ?? project.id} · {date(project.eliminado_en)}</span>
                  {!self && <button className={styles.plainButton} type="button" onClick={() => void act({ action: "restaurar_proyecto", proyectoId: project.id })}>Restaurar</button>}
                </div>
              ))}
            </>}

            <h3 className={admin.subtitle}>Sanciones</h3>
            {detail.sanctions.length ? detail.sanctions.map((item) => (
              <p key={item.id} className={styles.note}>{date(item.creada_en)} · {item.tipo}{item.hasta ? ` hasta ${date(item.hasta)}` : ""} · {item.motivo}{item.levantada_en ? " (levantada)" : ""}</p>
            )) : <p className={styles.note}>Sin sanciones.</p>}

            <h3 className={admin.subtitle}>Actividad reciente</h3>
            {detail.activity.map((item, index) => (
              <p key={index} className={styles.note}>{date(item.ocurrido_en)} · {item.accion} · {item.resultado}{item.ip_enmascarada ? ` · ${item.ip_enmascarada}` : ""}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
