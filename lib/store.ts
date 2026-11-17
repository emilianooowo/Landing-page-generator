"use client";

import { api, ApiError } from "@/lib/api";
import type { BusinessBrief } from "@/lib/schemas/brief";
import type { Section } from "@/lib/schemas/section";

/**
 * Project storage.
 * - Signed in: on the server (/api/projects), which checks ownership on every request.
 * - Guest: in this browser's localStorage until the person signs in; then the
 *   guest projects are imported into the account and removed from the browser.
 */
export type StoredProject = {
  id: string;
  ownerId?: string;
  name?: string;
  description: string;
  brief: BusinessBrief;
  sections: Section[];
  createdAt: string;
};

const GUEST_KEY = "lpg:projects:guest";
/** Per-account lists from version 0.1, when accounts lived in the browser. */
const LEGACY_PREFIX = "lpg:projects:u_";

let signedIn = false;
/** Set by the AuthProvider. */
export function setSignedIn(value: boolean) {
  signedIn = value;
}

export function newProjectId(): string {
  const random = crypto.getRandomValues(new Uint8Array(6));
  return `p_${Date.now().toString(36)}${Array.from(random, (byte) => (byte % 36).toString(36)).join("")}`;
}

/* ------------------------------------------------------------------ guest */

function readList(key: string): StoredProject[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed as StoredProject[] : [];
  } catch {
    return [];
  }
}

function writeGuest(projects: StoredProject[]) {
  if (projects.length) window.localStorage.setItem(GUEST_KEY, JSON.stringify(projects));
  else window.localStorage.removeItem(GUEST_KEY);
}

const byNewest = (a: StoredProject, b: StoredProject) => b.createdAt.localeCompare(a.createdAt);

/* ------------------------------------------------------------------ server */

/** What the server accepts: only finished sections, no client-only fields. */
function payload(project: StoredProject) {
  return {
    id: project.id,
    ...(project.name ? { name: project.name } : {}),
    description: project.description,
    brief: project.brief,
    sections: project.sections.filter((section) => section.status === "valid" || section.status === "fallback"),
    createdAt: project.createdAt,
  };
}

/** Saves of one project run in order, so a slow request never overwrites a newer one. */
const queues = new Map<string, Promise<void>>();

function enqueue(id: string, work: () => Promise<void>): Promise<void> {
  const next = (queues.get(id) ?? Promise.resolve()).catch(() => undefined).then(work);
  queues.set(id, next);
  void next.finally(() => { if (queues.get(id) === next) queues.delete(id); });
  return next;
}

/* ------------------------------------------------------------------ API */

export async function listProjects(): Promise<StoredProject[]> {
  if (typeof window === "undefined") return [];
  if (!signedIn) return readList(GUEST_KEY).sort(byNewest);
  return (await api<{ projects: StoredProject[] }>("/api/projects")).projects;
}

export async function loadProject(id: string): Promise<StoredProject | null> {
  if (typeof window === "undefined") return null;
  if (!signedIn) return readList(GUEST_KEY).find((project) => project.id === id) ?? null;
  try {
    return (await api<{ project: StoredProject }>(`/api/projects/${encodeURIComponent(id)}`)).project;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createProject(project: StoredProject): Promise<void> {
  if (!signedIn) {
    writeGuest([project, ...readList(GUEST_KEY).filter((item) => item.id !== project.id)]);
    return;
  }
  await enqueue(project.id, () => api("/api/projects", { method: "POST", body: payload(project) }).then(() => undefined));
}

export async function saveProject(project: StoredProject): Promise<void> {
  if (!signedIn) {
    const projects = readList(GUEST_KEY);
    const index = projects.findIndex((item) => item.id === project.id);
    if (index === -1) projects.unshift(project);
    else projects[index] = project;
    writeGuest(projects);
    return;
  }
  await enqueue(project.id, () => api(`/api/projects/${encodeURIComponent(project.id)}`, { method: "PUT", body: payload(project) }).then(() => undefined));
}

export async function deleteProject(id: string): Promise<void> {
  if (!signedIn) {
    writeGuest(readList(GUEST_KEY).filter((project) => project.id !== id));
    return;
  }
  await api(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** After signing in: moves the guest projects of this browser into the account. */
export async function importGuestProjects(): Promise<number> {
  if (typeof window === "undefined" || !signedIn) return 0;
  const pending = readList(GUEST_KEY);
  const left: StoredProject[] = [];
  for (const project of pending) {
    try {
      await api("/api/projects", { method: "POST", body: payload(project) });
    } catch {
      left.push(project);
    }
  }
  writeGuest(left);
  return pending.length - left.length;
}

/** Projects saved by version 0.1 under browser accounts. Imported only on request. */
export function legacyProjectKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(LEGACY_PREFIX)) keys.push(key);
  }
  return keys;
}

export function legacyProjectCount(): number {
  return legacyProjectKeys().reduce((total, key) => total + readList(key).length, 0);
}

export async function importLegacyProjects(): Promise<number> {
  let imported = 0;
  for (const key of legacyProjectKeys()) {
    const failed: StoredProject[] = [];
    for (const project of readList(key)) {
      try {
        await api("/api/projects", { method: "POST", body: payload(project) });
        imported += 1;
      } catch {
        failed.push(project);
      }
    }
    if (failed.length) window.localStorage.setItem(key, JSON.stringify(failed));
    else window.localStorage.removeItem(key);
  }
  return imported;
}

export function discardLegacyProjects() {
  legacyProjectKeys().forEach((key) => window.localStorage.removeItem(key));
}
