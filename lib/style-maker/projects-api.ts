/**
 * Browser client for Style Maker named-project cloud API.
 */

import type {
  StyleMakerProjectListItem,
  StyleMakerProjectWire,
  StyleMakerProjectWriteBody,
} from "@/lib/style-maker/project-store"

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    /* ignore */
  }
  return `Request failed (${response.status})`
}

export async function listStyleMakerProjects(): Promise<StyleMakerProjectListItem[]> {
  const response = await fetch("/api/style-maker/projects")
  if (!response.ok) throw new Error(await readError(response))
  const data = (await response.json()) as { projects: StyleMakerProjectListItem[] }
  return data.projects || []
}

export async function getStyleMakerProject(
  id: string,
): Promise<StyleMakerProjectWire> {
  const response = await fetch(`/api/style-maker/projects/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as StyleMakerProjectWire
}

export async function createStyleMakerProject(
  body: StyleMakerProjectWriteBody,
): Promise<StyleMakerProjectWire> {
  const response = await fetch("/api/style-maker/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as StyleMakerProjectWire
}

export async function updateStyleMakerProject(
  id: string,
  body: StyleMakerProjectWriteBody,
): Promise<StyleMakerProjectWire> {
  const response = await fetch(`/api/style-maker/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as StyleMakerProjectWire
}

export async function deleteStyleMakerProject(id: string): Promise<void> {
  const response = await fetch(`/api/style-maker/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) throw new Error(await readError(response))
}
