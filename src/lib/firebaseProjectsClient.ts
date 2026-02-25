import type { Project } from "./projects";

async function fetchWithAuth(
  url: string,
  options: RequestInit & { token?: string | null }
): Promise<Response> {
  const { token, ...rest } = options;
  const headers = new Headers(rest.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...rest, headers });
}

export async function fetchProjects(token: string | null): Promise<Project[]> {
  if (!token) return [];
  const res = await fetchWithAuth("/api/users/me/projects", { token });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function createProject(
  token: string | null,
  name?: string
): Promise<Project | null> {
  if (!token) return null;
  const res = await fetchWithAuth("/api/users/me/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name || "Untitled app" }),
    token,
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function getProject(
  token: string | null,
  projectId: string
): Promise<Project | null> {
  if (!token) return null;
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}`, { token });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function updateProject(
  token: string | null,
  projectId: string,
  updates: Partial<Pick<Project, "name" | "bundleId">>
): Promise<Project | null> {
  if (!token) return null;
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
    token,
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function deleteProject(
  token: string | null,
  projectId: string
): Promise<boolean> {
  if (!token) return false;
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}`, {
    method: "DELETE",
    token,
  });
  return res.ok;
}

export async function duplicateProject(
  token: string | null,
  projectId: string
): Promise<Project | null> {
  if (!token) return null;
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}/duplicate`, {
    method: "POST",
    token,
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function fetchProjectFiles(
  token: string | null,
  projectId: string
): Promise<Array<{ path: string; content: string }>> {
  if (!token) return [];
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}/files`, { token });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.files) ? data.files : [];
}

export async function saveProjectFiles(
  token: string | null,
  projectId: string,
  files: Array<{ path: string; content: string }>
): Promise<boolean> {
  if (!token) return false;
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
    token,
  });
  return res.ok;
}

export async function fetchProjectChat(
  token: string | null,
  projectId: string
): Promise<Array<{ id: string; role: string; content: string; editedFiles?: string[]; usage?: unknown; estimatedCostUsd?: number }>> {
  if (!token) return [];
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}/chat`, { token });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function saveProjectChat(
  token: string | null,
  projectId: string,
  messages: Array<{ id: string; role: string; content: string; editedFiles?: string[]; usage?: unknown; estimatedCostUsd?: number }>
): Promise<boolean> {
  if (!token) return false;
  const res = await fetchWithAuth(`/api/users/me/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    token,
  });
  return res.ok;
}
