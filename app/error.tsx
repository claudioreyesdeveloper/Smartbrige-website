"use client"

import { useEffect } from "react"
import Link from "next/link"

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
      <div className="content-wrap">
        <p className="section-label">Error</p>
        <h1 className="section-title">Something went wrong</h1>
        <p className="prose-muted mt-4 max-w-lg">
          The page failed to load. Try again, or return to the home page.
        </p>
        <div className="btn-row mt-8">
          <button type="button" className="btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn-secondary">Home</Link>
        </div>
      </div>
    </div>
  )
}
