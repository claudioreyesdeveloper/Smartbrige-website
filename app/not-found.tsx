import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { EmptyState } from "@/components/ux"

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="content-wrap" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
        <EmptyState
          icon={FileQuestion}
          title="Page not found"
          description="That URL doesn’t exist on this site. Head home or browse features."
          action={
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <Link href="/" className="btn-primary" style={{ minHeight: "2.75rem" }}>
                Home
              </Link>
              <Link href="/features" className="btn-secondary" style={{ minHeight: "2.75rem" }}>
                Features
              </Link>
            </div>
          }
        />
      </div>
    </div>
  )
}
