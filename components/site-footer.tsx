import Link from "next/link"
import { SITE } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div>
            <p className="section-title" style={{ fontSize: "1.125rem" }}>SmartBridge</p>
            <p className="prose-muted mt-2" style={{ maxWidth: "18rem", fontSize: "0.875rem" }}>
              From MIDI phrase to full arrangement. An independent project by Claudio Reyes.
            </p>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: "0.75rem" }}>Product</p>
            <ul className="site-footer-links">
              <li><Link href="/features">Features</Link></li>
              <li>
                <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer">Download Setup</a>
              </li>
              <li><Link href="/beta">Request beta access</Link></li>
            </ul>
          </div>
          <div>
            <p className="section-label" style={{ marginBottom: "0.75rem" }}>Contact</p>
            <ul className="site-footer-links">
              <li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
              <li><Link href="/about">About the creator</Link></li>
            </ul>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} SmartBridge. Not affiliated with Yamaha Corporation.</span>
          <span>Tyros · Genos · PSR-SX · Motif</span>
        </div>
      </div>
    </footer>
  )
}
