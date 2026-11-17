import { beforeAll, describe, expect, it } from "vitest";
import { passwordProblems, PASSWORD_MIN_LENGTH, minimumLength } from "@/lib/auth/passwordRules";
import { needsRehash } from "@/lib/auth/hash";
import { countInRange } from "@/lib/auth/pwned";
import { estimateStrength } from "@/lib/auth/strength";
import { applyFailure, emptyLock, lockStatus, LOCK_STEPS_MS } from "@/lib/server/lockout";
import { base32Decode, base32Encode, totpAt, verifyTotp } from "@/lib/server/totp";

beforeAll(() => {
  process.env.AUTH_SECRET = "a".repeat(40);
  process.env.DATA_ENCRYPTION_KEY = "b".repeat(40);
  process.env.PASSWORD_PEPPER = "c".repeat(40);
});

describe("password rules", () => {
  const context = { email: "ana.lopez@correo.com", name: "Ana López" };

  it("accepts a long, unrelated passphrase", () => {
    expect(passwordProblems("tortuga violeta sube al volcán", context)).toEqual([]);
  });

  it.each([
    ["corta", "caracteres"],
    ["aaaaaaaaaaaaaaaa", "repetidos"],
    ["abcabcabcabcabcabc", "repetidos"],
    ["1234567890123456", "secuencias"],
    ["ana.lopez es mi clave segura", "correo"],
    ["la casa de lopez en la playa", "nombre"],
    ["ana tiene una casa en la playa", "nombre"],
    ["mi landing favorita del mundo", "plataforma"],
  ])("rejects %s", (password, fragment) => {
    expect(passwordProblems(password, context).join(" ")).toContain(fragment);
  });

  it("doesn't treat a short name inside another word as the name", () => {
    expect(passwordProblems("naranjas maduras en el mercado", context)).toEqual([]);
  });

  it("asks for 15 characters without two-factor and 12 with it", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(15);
    expect(minimumLength({ twoFactor: true })).toBe(12);
    const twelve = "nube roja sol";
    expect(passwordProblems(twelve).join(" ")).toContain("15");
    expect(passwordProblems(twelve, { twoFactor: true })).toEqual([]);
    expect(passwordProblems("x".repeat(129)).join(" ")).toContain("128");
  });

  it("scores common passwords low and passphrases high", async () => {
    expect((await estimateStrength("password123456789")).score).toBeLessThan(3);
    expect((await estimateStrength("tortuga violeta sube al volcán")).score).toBeGreaterThanOrEqual(3);
  });
});

describe("Argon2id on the server", () => {
  it("hashes with the OWASP minimum, a unique salt and the pepper", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/server/passwords");
    const hash = await hashPassword("tortuga violeta sube al volcán");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword("tortuga violeta sube al volcán", hash)).toBe(true);
    expect(await verifyPassword("otra cosa", hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
    expect(await hashPassword("tortuga violeta sube al volcán")).not.toBe(hash);

    // Without the pepper (e.g. a stolen database alone) the hash doesn't verify.
    const pepper = process.env.PASSWORD_PEPPER;
    process.env.PASSWORD_PEPPER = "";
    expect(await verifyPassword("tortuga violeta sube al volcán", hash)).toBe(false);
    process.env.PASSWORD_PEPPER = pepper;
  });

  it("flags weaker parameters for rehashing", () => {
    expect(needsRehash("$argon2id$v=19$m=4096,t=3,p=1$c2FsdA$aGFzaA")).toBe(true);
    expect(needsRehash("8b8c9b2c2b1e3b1d")).toBe(true);
  });
});

describe("sign-in lockout", () => {
  it("locks users for 15, then 30, then 60 minutes after 5 failures in 15 minutes", () => {
    let state = emptyLock();
    let now = 1_000_000;
    for (let i = 0; i < 4; i++) state = applyFailure(state, now, false).state;
    expect(lockStatus(state, now).locked).toBe(false);
    let step = applyFailure(state, now, false);
    expect(step.event).toBe("locked");
    expect(lockStatus(step.state, now)).toEqual({ locked: true, kind: "temporary", remainingMs: LOCK_STEPS_MS[0] });

    now += LOCK_STEPS_MS[0];
    // 9 failures so far would be the next lock; total reaches 10 → reset required instead.
    state = step.state;
    for (let i = 0; i < 4; i++) state = applyFailure(state, now, false).state;
    step = applyFailure(state, now, false);
    expect(step.event).toBe("reset_required");
    expect(lockStatus(step.state, now)).toEqual({ locked: true, kind: "reset_required" });
  });

  it("escalates the lock duration", () => {
    let state = { ...emptyLock(), nivel: 1 };
    for (let i = 0; i < 5; i++) state = applyFailure(state, 0, false).state;
    expect(lockStatus(state, 0)).toMatchObject({ remainingMs: LOCK_STEPS_MS[1] });
  });

  it("locks staff after 3 failures until an administrator unlocks", () => {
    let state = emptyLock();
    state = applyFailure(state, 0, true).state;
    state = applyFailure(state, 0, true).state;
    const step = applyFailure(state, 0, true);
    expect(step.event).toBe("admin_required");
    expect(lockStatus(step.state, 10 ** 12)).toEqual({ locked: true, kind: "admin_required" });
  });

  it("forgets failures outside the 15-minute window", () => {
    let state = emptyLock();
    for (let i = 0; i < 4; i++) state = applyFailure(state, 0, false).state;
    expect(applyFailure(state, 16 * 60_000, false).event).toBe("none");
  });
});

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 appendix B, SHA-1 secret "12345678901234567890", 8 digits.
  const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));

  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("matches the reference value at t=%i", (time, code) => {
    expect(totpAt(secret, Math.floor(time / 30), 8)).toBe(code);
  });

  it("round-trips base32", () => {
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });

  it("accepts ±1 step and never the same step twice", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = totpAt(secret, step);
    expect(verifyTotp(secret, code, null, now)).toBe(step);
    expect(verifyTotp(secret, code, step, now)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step - 3), null, now)).toBeNull();
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
  });
});

describe("server crypto and tokens", () => {
  it("encrypts TOTP secrets with AES-256-GCM and detects tampering", async () => {
    const { decrypt, encrypt } = await import("@/lib/server/crypto");
    const sealed = encrypt("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decrypt(sealed)).toBe("JBSWY3DPEHPK3PXP");
    const parts = sealed.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("signs 15-minute access tokens and rejects forged ones", async () => {
    const { signAccessToken, verifyAccessToken } = await import("@/lib/server/jwt");
    const token = await signAccessToken({ sub: "u_1", sid: "s_1", rol: "usuario", lvl: "completo" });
    expect(await verifyAccessToken(token)).toEqual({ ok: true, claims: { sub: "u_1", sid: "s_1", rol: "usuario", lvl: "completo" } });
    const [header, payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), rol: "administrador" })).toString("base64url");
    expect(await verifyAccessToken(`${header}.${forged}.${signature}`)).toEqual({ ok: false, reason: "invalid" });
  });

  it("keeps tokens valid during a secret rotation", async () => {
    const { signAccessToken, verifyAccessToken } = await import("@/lib/server/jwt");
    const token = await signAccessToken({ sub: "u_1", sid: "s_1", rol: "usuario", lvl: "completo" });
    process.env.AUTH_SECRET_PREVIOUS = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "z".repeat(40);
    expect((await verifyAccessToken(token)).ok).toBe(true);
    process.env.AUTH_SECRET = process.env.AUTH_SECRET_PREVIOUS;
    delete process.env.AUTH_SECRET_PREVIOUS;
  });
});

describe("breached-password range check", () => {
  it("finds the suffix in the padded response", () => {
    const body = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\nFFFFF:0";
    expect(countInRange(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(3861493);
    expect(countInRange(body, "ABC")).toBe(0);
  });
});
