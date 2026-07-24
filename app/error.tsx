"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { EmptyState } from "@/components/ux"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="page-shell">
      <div className="content-wrap" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="The page failed to load. Try again, or return home."
          action={
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <button
                type="button"
                className="btn-primary"
                style={{ minHeight: "2.75rem" }}
                onClick={() => reset()}
              >
                Try again
              </button>
              <Link
                href="/"
                className="btn-secondary"
                style={{ minHeight: "2.75rem" }}
              >
                Home
              </Link>
            </div>
          }
        />
      </div>
    </div>
  )
}
