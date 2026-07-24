import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SITE } from "@/lib/site"

export function CtaBand({
  title = "Start with Style Maker — or join the desktop beta",
  body = "Style Maker is available now with a 14-day free trial. The full desktop SmartBridge suite remains invitation-only beta.",
  primaryHref = "/style-maker",
  primaryLabel = "Start Style Maker free trial",
  showSetup = true,
}: {
  title?: string
  body?: string
  primaryHref?: string
  primaryLabel?: string
  showSetup?: boolean
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
            {showSetup && (
              <a href={SITE.setupUrl} className="btn-secondary" target="_blank" rel="noopener noreferrer">
                Download Setup
              </a>
            )}
            <Link href="/beta" className="btn-secondary">
              Request beta access
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
