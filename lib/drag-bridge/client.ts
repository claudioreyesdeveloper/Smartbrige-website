/**
 * Client for SmartBridge Drag Bridge (macOS + Windows Electron companion).
 * POST MIDI bytes → companion writes the real .mid and shows an OS-drag chip
 * (Electron startDrag), which Cubase accepts — unlike browser DownloadURL.
 */

export const DRAG_BRIDGE_PORT = 19527
export const DRAG_BRIDGE_BASE = `http://127.0.0.1:${DRAG_BRIDGE_PORT}`

export type DragBridgeHealth = {
  ok: boolean
  service?: string
  port?: number
  platform?: string
}

export type DragBridgePrepareResult = {
  ok: boolean
  path?: string
  error?: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function dragBridgeHealth(
  timeoutMs = 400,
): Promise<DragBridgeHealth | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${DRAG_BRIDGE_BASE}/v1/health`, {
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok) return null
    return (await response.json()) as DragBridgeHealth
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

export async function prepareDragViaBridge(options: {
  fileName: string
  midiBytes: Uint8Array
}): Promise<DragBridgePrepareResult> {
  const response = await fetch(`${DRAG_BRIDGE_BASE}/v1/prepare-drag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: options.fileName,
      dataBase64: bytesToBase64(options.midiBytes),
    }),
  })
  const body = (await response.json().catch(() => ({}))) as DragBridgePrepareResult
  if (!response.ok) {
    return { ok: false, error: body.error || `http_${response.status}` }
  }
  return body
}
