"use client"

import { useState } from "react"
import type { ServiceKey } from "@/lib/services/catalog"

type CheckoutButtonProps = {
  serviceKey: ServiceKey
  label?: string
  disabled?: boolean
  className?: string
}

export function CheckoutButton({
  serviceKey,
  label = "Subscribe",
  disabled = false,
  className,
}: CheckoutButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setError(null)
    setPending(true)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceKey }),
      })
      const data = (await response.json()) as {
        checkoutUrl?: string
        error?: string
      }
      if (!response.ok || !data.checkoutUrl) {
        setError(data.error ?? "Checkout could not be started.")
        return
      }
      window.location.assign(data.checkoutUrl)
    } catch {
      setError("Checkout could not be started.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="billing-action">
      <button
        type="button"
        className={className ?? "app-shell-btn app-shell-btn-accent"}
        onClick={onClick}
        disabled={disabled || pending}
      >
        {pending ? "Redirecting…" : label}
      </button>
      {error ? (
        <p role="alert" className="billing-action-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
