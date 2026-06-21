"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0b1220", color: "#f5f5f4", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>SmartBridge</h1>
        <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>Something went wrong loading the site.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: "#4a9eff",
            color: "#0b1220",
            border: "none",
            padding: "0.75rem 1.25rem",
            borderRadius: "9999px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
