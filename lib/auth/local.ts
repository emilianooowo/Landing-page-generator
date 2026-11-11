export type LocalUser = {
  id: string;
  name: string;
  email: string;
};

type LocalAccount = LocalUser & {
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

const ACCOUNTS_KEY = "lpg:accounts";
const SESSION_KEY = "lpg:active-account";

function accounts(): LocalAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(data) ? data as LocalAccount[] : [];
  } catch {
    return [];
  }
}

function saveAccounts(value: LocalAccount[]) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(value));
}

function publicUser(account: LocalAccount): LocalUser {
  return { id: account.id, name: account.name, email: account.email };
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getLocalUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(SESSION_KEY);
  const account = accounts().find((candidate) => candidate.id === id);
  return account ? publicUser(account) : null;
}

export async function createLocalAccount(name: string, email: string, password: string): Promise<LocalUser> {
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const normalizedEmail = email.trim().toLocaleLowerCase("es-MX");
  if (accounts().some((account) => account.email === normalizedEmail)) {
    throw new Error("Ya existe una cuenta con ese correo.");
  }

  const salt = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const account: LocalAccount = {
    id: `u_${window.crypto.randomUUID()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };

  saveAccounts([...accounts(), account]);
  window.localStorage.setItem(SESSION_KEY, account.id);
  return publicUser(account);
}

export async function signInLocalAccount(email: string, password: string): Promise<LocalUser> {
  const normalizedEmail = email.trim().toLocaleLowerCase("es-MX");
  const account = accounts().find((candidate) => candidate.email === normalizedEmail);
  if (!account || account.passwordHash !== await hashPassword(password, account.passwordSalt)) {
    throw new Error("El correo o la contraseña no coinciden.");
  }
  window.localStorage.setItem(SESSION_KEY, account.id);
  return publicUser(account);
}

export function signOutLocalAccount() {
  if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
}

export function updateLocalUser(user: LocalUser): LocalUser {
  const normalizedEmail = user.email.trim().toLocaleLowerCase("es-MX");
  if (accounts().some((account) => account.id !== user.id && account.email === normalizedEmail)) {
    throw new Error("Ese correo ya está asociado a otra cuenta.");
  }
  const updatedUser = { ...user, name: user.name.trim(), email: normalizedEmail };
  const next = accounts().map((account) => account.id === user.id ? { ...account, ...updatedUser } : account);
  saveAccounts(next);
  return updatedUser;
}

export async function changeLocalPassword(userId: string, currentPassword: string, nextPassword: string): Promise<void> {
  if (nextPassword.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
  const all = accounts();
  const account = all.find((candidate) => candidate.id === userId);
  if (!account || account.passwordHash !== await hashPassword(currentPassword, account.passwordSalt)) {
    throw new Error("La contraseña actual no coincide.");
  }
  const salt = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const passwordHash = await hashPassword(nextPassword, salt);
  saveAccounts(all.map((candidate) => candidate.id === userId
    ? { ...candidate, passwordSalt: salt, passwordHash }
    : candidate));
}

export function deleteLocalAccount(userId: string) {
  const next = accounts().filter((account) => account.id !== userId);
  saveAccounts(next);
  window.localStorage.removeItem(`lpg:projects:${userId}`);
  if (window.localStorage.getItem(SESSION_KEY) === userId) window.localStorage.removeItem(SESSION_KEY);
}
