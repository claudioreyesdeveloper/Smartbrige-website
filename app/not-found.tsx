import Link from "next/link"

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="content-wrap">
        <p className="section-label">404</p>
        <h1 className="section-title">Page not found</h1>
        <p className="prose-muted mt-4">That URL doesn&apos;t exist on this site.</p>
        <div className="btn-row mt-8">
          <Link href="/" className="btn-primary">Home</Link>
          <Link href="/features" className="btn-secondary">Features</Link>
        </div>
      </div>
    </div>
  )
}
