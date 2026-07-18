export type ProjectDownloadFn = (
  filename: string,
  contents: string,
  mimeType: string,
) => void

export const browserDownload: ProjectDownloadFn = (filename, contents, mimeType) => {
  if (typeof document === "undefined") {
    throw new Error("Download is only available in a browser environment.")
  }
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function serializeLocalProjectCopy(input: {
  title: string
  document: unknown
  projectId?: string | null
  revisionId?: string | null
  version?: number | null
}): string {
  return `${JSON.stringify(
    {
      kind: "smartbridge-project-local-copy",
      exportedAt: new Date().toISOString(),
      projectId: input.projectId ?? null,
      revisionId: input.revisionId ?? null,
      version: input.version ?? null,
      title: input.title,
      document: input.document,
    },
    null,
    2,
  )}\n`
}
