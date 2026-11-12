"use client";

import type { BusinessBrief } from "@/lib/schemas/brief";
import type { Section } from "@/lib/schemas/section";
import { getLocalUser } from "@/lib/auth/local";

/**
 * Local demo storage: each browser account owns a localStorage project list.
 * It survives restarts in this browser but does not sync or provide server-side
 * access control; replace this adapter with a database before production.
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

const PROJECTS_KEY = (ownerId: string) => `lpg:projects:${ownerId}`;
const GUEST_PROJECTS_KEY = "lpg:projects:guest";
const PENDING_PROJECT_KEY = "lpg:pending-project";

export function newProjectId(): string {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function savePendingProject(project: StoredProject): void {
  if (typeof window !== "undefined") window.localStorage.setItem(PENDING_PROJECT_KEY, JSON.stringify(project));
}

export function consumePendingProject(): string | null {
  if (typeof window === "undefined" || !getLocalUser()) return null;
  try {
    const raw = window.localStorage.getItem(PENDING_PROJECT_KEY);
    if (!raw) return null;
    const project = JSON.parse(raw) as StoredProject;
    saveProject(project);
    window.localStorage.removeItem(PENDING_PROJECT_KEY);
    return project.id;
  } catch {
    window.localStorage.removeItem(PENDING_PROJECT_KEY);
    return null;
  }
}

export function saveProject(project: StoredProject): void {
  if (typeof window === "undefined") return;
  const user = getLocalUser();
  if (!user) {
    if (project.ownerId) return;
    const projects = readGuestProjects();
    const index = projects.findIndex((item) => item.id === project.id);
    if (index === -1) projects.unshift(project);
    else projects[index] = project;
    window.localStorage.setItem(GUEST_PROJECTS_KEY, JSON.stringify(projects));
    return;
  }
  if (project.ownerId && project.ownerId !== user.id) return;
  const projects = readProjects(user.id);
  const next = { ...project, ownerId: user.id };
  const index = projects.findIndex((item) => item.id === project.id);
  if (index === -1) projects.unshift(next);
  else projects[index] = next;
  window.localStorage.setItem(PROJECTS_KEY(user.id), JSON.stringify(projects));
}

export function loadProject(id: string): StoredProject | null {
  if (typeof window === "undefined") return null;
  const user = getLocalUser();
  const projects = user ? readProjects(user.id) : readGuestProjects();
  return projects.find((project) => project.id === id) ?? null;
}

export function listProjects(): StoredProject[] {
  if (typeof window === "undefined") return [];
  const user = getLocalUser();
  return user ? readProjects(user.id) : readGuestProjects();
}

export function deleteProject(id: string): void {
  if (typeof window === "undefined") return;
  const user = getLocalUser();
  if (!user) {
    window.localStorage.setItem(GUEST_PROJECTS_KEY, JSON.stringify(readGuestProjects().filter((project) => project.id !== id)));
    return;
  }
  window.localStorage.setItem(
    PROJECTS_KEY(user.id),
    JSON.stringify(readProjects(user.id).filter((project) => project.id !== id)),
  );
}

export function claimGuestProjects(): void {
  if (typeof window === "undefined" || !getLocalUser()) return;
  const projects = readGuestProjects();
  projects.forEach((project) => saveProject(project));
  window.localStorage.removeItem(GUEST_PROJECTS_KEY);
}

function readGuestProjects(): StoredProject[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(GUEST_PROJECTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as StoredProject[] : [];
  } catch {
    return [];
  }
}

function readProjects(ownerId: string): StoredProject[] {
  const key = PROJECTS_KEY(ownerId);
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    const projects = Array.isArray(parsed) ? parsed as StoredProject[] : [];
    let migrated = false;
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const oldKey = window.sessionStorage.key(index);
      if (!oldKey?.startsWith("lpg:project:")) continue;
      try {
        const oldProject = JSON.parse(window.sessionStorage.getItem(oldKey) ?? "null") as StoredProject | null;
        if (oldProject && !projects.some((project) => project.id === oldProject.id)) {
          projects.push({ ...oldProject, ownerId });
          migrated = true;
        }
        window.sessionStorage.removeItem(oldKey);
      } catch {
        window.sessionStorage.removeItem(oldKey);
      }
    }
    if (migrated) window.localStorage.setItem(key, JSON.stringify(projects));
    return [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
