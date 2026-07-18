"use client"

import { useState } from "react"

type PortalButtonProps = {
  label?: string
  className?: string
}

export function PortalButton({
  label = "Manage billing",
  className,
}: PortalButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setError(null)
    setPending(true)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const data = (await response.json()) as {
        portalUrl?: string
        error?: string
      }
      if (!response.ok || !data.portalUrl) {
        setError(data.error ?? "Billing portal could not be opened.")
        return
      }
      window.location.assign(data.portalUrl)
    } catch {
      setError("Billing portal could not be opened.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="billing-action">
      <button
        type="button"
        className={className ?? "app-shell-btn app-shell-btn-secondary"}
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Opening…" : label}
      </button>
      {error ? (
        <p role="alert" className="billing-action-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
