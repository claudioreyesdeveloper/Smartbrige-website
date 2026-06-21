import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SITE } from "@/lib/site"

export function CtaBand({
  title = "Ready to try SmartBridge?",
  body = "Request beta access or download SmartBridge Setup to install the latest build.",
  primaryHref = "/beta",
  primaryLabel = "Request beta access",
}: {
  title?: string
  body?: string
  primaryHref?: string
  primaryLabel?: string
}) {
  return (
    <section className="section-block">
      <div className="content-wrap">
        <div className="cta-band">
          <h2 className="section-title">{title}</h2>
          <p className="prose-muted" style={{ marginTop: "1rem", maxWidth: "36rem" }}>{body}</p>
          <div className="btn-row" style={{ marginTop: "2rem" }}>
            <Link href={primaryHref} className="btn-primary">
              {primaryLabel}
              <ArrowRight size={16} />
            </Link>
            <a href={SITE.setupUrl} className="btn-secondary" target="_blank" rel="noopener noreferrer">
              Download Setup
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
