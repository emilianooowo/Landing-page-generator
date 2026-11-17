/**
 * End-to-end checks of block B against a real PostgreSQL. They call the route
 * handlers exactly as the browser would (cookies, Origin, JSON).
 *
 * Run with a dedicated, migrated database:
 *   INTEGRATION_DATABASE_URL=postgres://…/landing_ia_test npm test
 * Without that variable the suite is skipped.
 */
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.INTEGRATION_DATABASE_URL;
const suite = describe.skipIf(!url);

type Jar = Map<string, string>;
const HOST = "localhost:3000";
let ipCounter = 0;
const newIp = () => `10.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}.${Math.floor(Math.random() * 250)}`;

function request(path: string, init: { method?: string; body?: unknown; jar?: Jar; ip?: string } = {}) {
  const headers: Record<string, string> = { host: HOST, origin: `http://${HOST}`, "sec-fetch-site": "same-origin", "x-forwarded-for": init.ip ?? newIp() };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.jar?.size) headers.cookie = [...init.jar].map(([key, value]) => `${key}=${value}`).join("; ");
  return new Request(`http://${HOST}${path}`, { method: init.method ?? (init.body === undefined ? "GET" : "POST"), headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}

function absorb(response: Response, jar: Jar) {
  for (const line of response.headers.getSetCookie()) {
    const [pair, ...attributes] = line.split(";");
    const [key, value] = pair.split("=");
    if (attributes.some((attribute) => /max-age=0/i.test(attribute)) || value === "") jar.delete(key.trim());
    else jar.set(key.trim(), value);
  }
  return response;
}

async function body(response: Response) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper over loosely shaped JSON
  return response.json() as Promise<Record<string, any>>;
}

let outbox = "";
async function lastLink(kind: "verificar" | "restablecer"): Promise<string> {
  const files = (await readdir(outbox)).sort();
  for (const file of files.reverse()) {
    const match = new RegExp(`/${kind}#t=([A-Za-z0-9_-]+)`).exec(await readFile(path.join(outbox, file), "utf8"));
    if (match) return match[1];
  }
  throw new Error("No email with that link.");
}

const routes = {
  register: () => import("@/app/api/auth/register/route"),
  verify: () => import("@/app/api/auth/verify-email/route"),
  login: () => import("@/app/api/auth/login/route"),
  refresh: () => import("@/app/api/auth/refresh/route"),
  me: () => import("@/app/api/auth/me/route"),
  change: () => import("@/app/api/auth/change-password/route"),
  forgot: () => import("@/app/api/auth/forgot-password/route"),
  reset: () => import("@/app/api/auth/reset-password/route"),
  totp: () => import("@/app/api/auth/totp/route"),
  projects: () => import("@/app/api/projects/route"),
  project: () => import("@/app/api/projects/[id]/route"),
  adminUsers: () => import("@/app/api/admin/users/route"),
  adminUser: () => import("@/app/api/admin/users/[id]/route"),
  adminAudit: () => import("@/app/api/admin/audit/route"),
  parseBrief: () => import("@/app/api/parse-brief/route"),
};

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const PASSWORD = "tortuga violeta sube al volcán";

async function createVerifiedUser(email: string, name = "Persona de Prueba") {
  const ip = newIp();
  const { POST: register } = await routes.register();
  expect((await register(request("/api/auth/register", { ip, body: { name, email, password: PASSWORD, termsAccepted: true } }))).status).toBe(202);
  const { POST: verify } = await routes.verify();
  expect((await verify(request("/api/auth/verify-email", { ip, body: { token: await lastLink("verificar") } }))).status).toBe(200);
}

async function signIn(email: string, password = PASSWORD, code?: string) {
  const jar: Jar = new Map();
  const { POST } = await routes.login();
  const response = absorb(await POST(request("/api/auth/login", { ip: newIp(), body: { email, password, ...(code ? { code } : {}) } })), jar);
  return { jar, response, data: await body(response) };
}

const brief = {
  businessName: "Pastelería Luna", hasBusinessName: true, whatTheyDo: "Pasteles artesanales para cumpleaños", audience: "Familias de Tuxtla",
  vibe: ["warm"], imageWorld: "food-drink", desiredAction: "Escríbenos por WhatsApp", keyPoints: [], hasCustomers: false, sections: ["hero", "cta"], style: "warm",
};

suite("block B against PostgreSQL", () => {
  let db: typeof import("@/lib/server/db");

  beforeAll(async () => {
    outbox = path.join(await mkdtemp(path.join(tmpdir(), "landing-ia-")), "outbox");
    process.env.DATABASE_URL = url;
    process.env.DATA_DIR = path.dirname(outbox);
    process.env.AUTH_SECRET = "a".repeat(48);
    process.env.DATA_ENCRYPTION_KEY = "b".repeat(48);
    process.env.PASSWORD_PEPPER = "c".repeat(48);
    process.env.AI_DAILY_GENERATIONS = "0";
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Have I Been Pwned: no breach for our test passwords (no network in tests).
    vi.stubGlobal("fetch", vi.fn(async () => new Response("0000000000000000000000000000000000A:1\n", { status: 200 })));
    db = await import("@/lib/server/db");
    await db.query(`TRUNCATE usuarios, sesiones, tokens_correo, bloqueos_cuenta, fallos_ip, bloqueos_ip, sanciones, uso_generaciones,
      historial_contrasenas, imagenes, proyectos CASCADE`);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db?.closePool();
  });

  it("registers, requires email verification and signs in with HttpOnly cookies", async () => {
    const { POST: register } = await routes.register();
    const weak = await register(request("/api/auth/register", { ip: newIp(), body: { name: "Ana", email: "ana@prueba.mx", password: "corta", termsAccepted: true } }));
    expect(weak.status).toBe(422);

    expect((await register(request("/api/auth/register", { ip: newIp(), body: { name: "Ana", email: "ana@prueba.mx", password: PASSWORD, termsAccepted: true } }))).status).toBe(202);
    const before = await signIn("ana@prueba.mx");
    expect(before.response.status).toBe(403);
    expect(before.data.code).toBe("email_unverified");

    // A second registration with the same email answers the same (no enumeration).
    expect((await register(request("/api/auth/register", { ip: newIp(), body: { name: "Otra", email: "ana@prueba.mx", password: PASSWORD, termsAccepted: true } }))).status).toBe(202);

    const { POST: verify } = await routes.verify();
    expect((await verify(request("/api/auth/verify-email", { body: { token: await lastLink("verificar") } }))).status).toBe(200);

    const { jar, response, data } = await signIn("ana@prueba.mx");
    expect(response.status).toBe(200);
    expect(data.user).toMatchObject({ email: "ana@prueba.mx", role: "usuario" });
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toMatch(/lia_at=.*HttpOnly/i);
    expect(cookies).toMatch(/lia_at=.*SameSite=strict/i);
    expect(cookies).toMatch(/lia_rt=.*Path=\/api\/auth/i);

    const { GET: me } = await routes.me();
    expect((await body(await me(request("/api/auth/me", { jar })))).user.email).toBe("ana@prueba.mx");
    expect((await me(request("/api/auth/me"))).status).toBe(401);

    const row = await db.one<{ hash_contrasena: string }>("SELECT hash_contrasena FROM usuarios WHERE correo = 'ana@prueba.mx'");
    expect(row?.hash_contrasena).toMatch(/^\$argon2id\$/);
  });

  it("isolates projects by owner and audits cross-account attempts", async () => {
    await createVerifiedUser("beto@prueba.mx", "Beto");
    const ana = await signIn("ana@prueba.mx");
    const beto = await signIn("beto@prueba.mx");
    const { POST: create, GET: list } = await routes.projects();
    const { GET: read, PUT: update, DELETE: remove } = await routes.project();
    const project = { id: "p_anaproyecto1", description: "Pasteles", brief, sections: [] };

    expect((await create(request("/api/projects", { jar: ana.jar, body: project }))).status).toBe(201);
    expect((await body(await list(request("/api/projects", { jar: ana.jar })))).projects).toHaveLength(1);
    expect((await body(await list(request("/api/projects", { jar: beto.jar })))).projects).toHaveLength(0);

    expect((await read(request("/api/projects/p_anaproyecto1", { jar: beto.jar }), params("p_anaproyecto1"))).status).toBe(404);
    expect((await update(request("/api/projects/p_anaproyecto1", { method: "PUT", jar: beto.jar, body: { ...project, name: "Robado" } }), params("p_anaproyecto1"))).status).toBe(404);
    expect((await create(request("/api/projects", { jar: beto.jar, body: { ...project, name: "Robado" } }))).status).toBe(409);
    expect((await remove(request("/api/projects/p_anaproyecto1", { method: "DELETE", jar: beto.jar }), params("p_anaproyecto1"))).status).toBe(404);

    const stored = await body(await read(request("/api/projects/p_anaproyecto1", { jar: ana.jar }), params("p_anaproyecto1")));
    expect(stored.project.name).toBeUndefined();
    const denied = await db.query("SELECT 1 FROM bitacora_auditoria WHERE accion = 'acceso_denegado_proyecto' AND objetivo_id = 'p_anaproyecto1'");
    expect(denied.length).toBeGreaterThanOrEqual(3);

    // Soft delete by the owner.
    expect((await remove(request("/api/projects/p_anaproyecto1", { method: "DELETE", jar: ana.jar }), params("p_anaproyecto1"))).status).toBe(200);
    expect((await body(await list(request("/api/projects", { jar: ana.jar })))).projects).toHaveLength(0);
    expect((await db.query("SELECT eliminado_en FROM proyectos WHERE id = 'p_anaproyecto1'"))[0].eliminado_en).not.toBeNull();
  });

  it("rotates refresh tokens and revokes the family when an old one is reused", async () => {
    const { jar } = await signIn("ana@prueba.mx");
    const oldRefresh = jar.get("lia_rt")!;
    const { POST: refresh } = await routes.refresh();
    const rotated = absorb(await refresh(request("/api/auth/refresh", { jar })), jar);
    expect(rotated.status).toBe(200);
    expect(jar.get("lia_rt")).not.toBe(oldRefresh);

    // Immediate reuse looks like a parallel tab: not an attack.
    const stolen: Jar = new Map([["lia_rt", oldRefresh]]);
    expect((await refresh(request("/api/auth/refresh", { jar: stolen }))).status).toBe(409);

    // Later reuse: theft. The whole family dies, including the legitimate session.
    await db.query("UPDATE sesiones SET revocada_en = now() - interval '5 minutes' WHERE motivo_revocacion = 'rotada'");
    expect((await refresh(request("/api/auth/refresh", { jar: stolen }))).status).toBe(401);
    expect((await refresh(request("/api/auth/refresh", { jar }))).status).toBe(401);
    const { GET: me } = await routes.me();
    expect((await me(request("/api/auth/me", { jar }))).status).toBe(401);
    expect((await db.query("SELECT 1 FROM bitacora_auditoria WHERE accion = 'reuso_token_renovacion' AND ocurrido_en > now() - interval '1 minute'")).length).toBeGreaterThanOrEqual(1);
  });

  it("ends idle sessions after 30 minutes", async () => {
    const { jar } = await signIn("beto@prueba.mx");
    await db.query("UPDATE sesiones SET ultima_actividad_en = now() - interval '31 minutes' WHERE revocada_en IS NULL AND usuario_id = (SELECT id FROM usuarios WHERE correo = 'beto@prueba.mx')");
    const { GET: me } = await routes.me();
    expect((await me(request("/api/auth/me", { jar }))).status).toBe(401);
    const { POST: refresh } = await routes.refresh();
    expect((await body(await refresh(request("/api/auth/refresh", { jar })))).code).toBe("session_ended");
  });

  it("locks an account after 5 failures and an IP after more than 10", async () => {
    await createVerifiedUser("carla@prueba.mx", "Carla");
    const { POST: login } = await routes.login();
    const ip = newIp();
    const attempt = (email: string, password: string, from = ip) => login(request("/api/auth/login", { ip: from, body: { email, password } }));
    for (let i = 0; i < 4; i++) expect((await attempt("carla@prueba.mx", "incorrecta")).status).toBe(401);
    const fifth = await attempt("carla@prueba.mx", "incorrecta");
    expect(fifth.status).toBe(423);
    expect((await body(fifth)).error).toContain("15 minutos");
    // Even the right password waits.
    expect((await attempt("carla@prueba.mx", PASSWORD, newIp())).status).toBe(423);
    // Unknown emails get the same treatment (nothing to learn).
    for (let i = 0; i < 5; i++) await attempt("nadie@prueba.mx", "x");
    // 11th failure from this IP in 5 minutes: the IP gets blocked for 30 minutes.
    expect((await attempt("otra@prueba.mx", "x")).status).toBe(401);
    expect((await attempt("ana@prueba.mx", PASSWORD)).status).toBe(429);
    expect((await db.query("SELECT 1 FROM bitacora_auditoria WHERE accion = 'ip_bloqueada'")).length).toBeGreaterThan(0);
  });

  it("changes passwords with history, and resets them by email", async () => {
    const ana = await signIn("ana@prueba.mx");
    const other = await signIn("ana@prueba.mx");
    const { POST: change } = await routes.change();
    const reuse = await change(request("/api/auth/change-password", { jar: ana.jar, body: { currentPassword: PASSWORD, newPassword: PASSWORD } }));
    expect(reuse.status).toBe(422);
    const next = "jirafa naranja canta en la lluvia";
    expect((await change(request("/api/auth/change-password", { jar: ana.jar, body: { currentPassword: PASSWORD, newPassword: next } }))).status).toBe(200);
    // Other sessions are closed.
    const { GET: me } = await routes.me();
    expect((await me(request("/api/auth/me", { jar: other.jar }))).status).toBe(401);
    expect((await me(request("/api/auth/me", { jar: ana.jar }))).status).toBe(200);

    const { POST: forgot } = await routes.forgot();
    expect((await forgot(request("/api/auth/forgot-password", { ip: newIp(), body: { email: "ana@prueba.mx" } }))).status).toBe(202);
    expect((await forgot(request("/api/auth/forgot-password", { ip: newIp(), body: { email: "nadie@prueba.mx" } }))).status).toBe(202);
    const token = await lastLink("restablecer");
    const { POST: reset } = await routes.reset();
    // Back to an old password: refused, and the link stays usable.
    expect((await reset(request("/api/auth/reset-password", { body: { token, password: PASSWORD } }))).status).toBe(422);
    const fresh = "colibri azul duerme bajo el puente";
    expect((await reset(request("/api/auth/reset-password", { body: { token, password: fresh } }))).status).toBe(200);
    expect((await reset(request("/api/auth/reset-password", { body: { token, password: "otra frase muy distinta y larga" } }))).status).toBe(400);
    expect((await me(request("/api/auth/me", { jar: ana.jar }))).status).toBe(401);
    expect((await signIn("ana@prueba.mx", fresh)).response.status).toBe(200);
  });

  it("enforces roles, two-factor for staff and administrative sanctions", async () => {
    await createVerifiedUser("admin@prueba.mx", "Admin");
    await createVerifiedUser("analista@prueba.mx", "Analista");
    await db.query("UPDATE usuarios SET rol = 'administrador' WHERE correo = 'admin@prueba.mx'");
    await db.query("UPDATE usuarios SET rol = 'analista' WHERE correo = 'analista@prueba.mx'");

    const admin = await signIn("admin@prueba.mx");
    expect(admin.data.user.mustSetupTwoFactor).toBe(true);
    const { GET: users } = await routes.adminUsers();
    expect((await body(await users(request("/api/admin/users", { jar: admin.jar })))).code).toBe("two_factor_setup_required");

    const { POST: setup, PUT: enable } = await routes.totp();
    const { secret } = await body(await setup(request("/api/auth/totp", { method: "POST", jar: admin.jar })));
    const { totpAt, currentStep } = await import("@/lib/server/totp");
    const enabled = absorb(await enable(request("/api/auth/totp", { method: "PUT", jar: admin.jar, body: { code: totpAt(secret, currentStep()) } })), admin.jar);
    expect(enabled.status).toBe(200);
    expect((await users(request("/api/admin/users", { jar: admin.jar }))).status).toBe(200);
    const totpRow = await db.one<{ totp_secreto_cifrado: string }>("SELECT totp_secreto_cifrado FROM usuarios WHERE correo = 'admin@prueba.mx'");
    expect(totpRow?.totp_secreto_cifrado).not.toContain(secret);

    // Next sign-in asks for the code, and a used code can't be replayed.
    const step = await signIn("admin@prueba.mx");
    expect(step.data.code).toBe("totp_required");
    const replay = await signIn("admin@prueba.mx", PASSWORD, totpAt(secret, currentStep()));
    expect(replay.data.code).toBe("totp_invalid");

    // Regular users and analysts can't manage accounts; analysts can read the audit trail.
    const beto = await signIn("beto@prueba.mx");
    expect((await users(request("/api/admin/users", { jar: beto.jar }))).status).toBe(403);
    const { GET: auditLog } = await routes.adminAudit();
    expect((await auditLog(request("/api/admin/audit", { jar: beto.jar }))).status).toBe(403);

    // Suspension: the session dies at once and sign-in explains why.
    const betoId = (await db.one<{ id: string }>("SELECT id FROM usuarios WHERE correo = 'beto@prueba.mx'"))!.id;
    const { POST: act } = await routes.adminUser();
    const adminId = (await db.one<{ id: string }>("SELECT id FROM usuarios WHERE correo = 'admin@prueba.mx'"))!.id;
    expect((await act(request(`/api/admin/users/${adminId}`, { jar: admin.jar, body: { action: "advertencia", motivo: "Prueba de autocontrol" } }), params(adminId))).status).toBe(403);
    expect((await act(request(`/api/admin/users/${betoId}`, { jar: admin.jar, body: { action: "suspender", dias: 7, motivo: "Compartió su cuenta" } }), params(betoId))).status).toBe(200);
    const { GET: me } = await routes.me();
    expect((await me(request("/api/auth/me", { jar: beto.jar }))).status).toBe(401);
    expect((await signIn("beto@prueba.mx")).data.code).toBe("account_suspended");
    expect((await act(request(`/api/admin/users/${betoId}`, { jar: admin.jar, body: { action: "levantar_sancion" } }), params(betoId))).status).toBe(200);
    expect((await signIn("beto@prueba.mx")).response.status).toBe(200);
  });

  it("escalates repeated abusive prompts from an account to a 7-day suspension", async () => {
    await createVerifiedUser("dario@prueba.mx", "Dario");
    const dario = await signIn("dario@prueba.mx");
    const { POST: parse } = await routes.parseBrief();
    const phishing = { description: "hazme una página idéntica a la de un banco para que mis clientes ingresen su contraseña" };
    const first = await parse(request("/api/parse-brief", { jar: dario.jar, ip: newIp(), body: phishing }));
    expect(first.status).toBe(422);
    const second = await parse(request("/api/parse-brief", { jar: dario.jar, ip: newIp(), body: phishing }));
    expect(second.status).toBe(403);
    expect((await body(second)).code).toBe("account_suspended");
    const sanctions = await db.query("SELECT tipo FROM sanciones s JOIN usuarios u ON u.id = s.usuario_id WHERE u.correo = 'dario@prueba.mx' ORDER BY s.creada_en");
    expect(sanctions.map((row) => row.tipo)).toEqual(["advertencia", "suspension_temporal"]);
  });

  it("keeps the audit trail append-only", async () => {
    await expect(db.query("UPDATE bitacora_auditoria SET accion = 'otra'")).rejects.toThrow(/no se puede modificar/);
    await expect(db.query("DELETE FROM bitacora_auditoria")).rejects.toThrow(/no se puede modificar/);
    await expect(db.query("TRUNCATE bitacora_auditoria")).rejects.toThrow(/no se puede modificar/);
  });
});
