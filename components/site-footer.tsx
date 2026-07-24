import Link from "next/link"
import { SITE } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div>
            <p className="ux-section-label">SmartBridge</p>
            <p
              className="section-title"
              style={{ fontSize: "1.25rem", marginTop: "0.75rem" }}
            >
              From phrase to arrangement
            </p>
            <p
              className="prose-muted"
              style={{ maxWidth: "20rem", fontSize: "0.9rem", marginTop: "0.75rem" }}
            >
              An independent project by Claudio Reyes. Build, audition, and transfer
              styles to your Yamaha arranger.
            </p>
          </div>
          <div>
            <p className="ux-section-label" style={{ marginBottom: "0.85rem" }}>
              Product
            </p>
            <ul className="site-footer-links">
              <li>
                <Link href="/style-maker">Try Style Maker</Link>
              </li>
              <li>
                <Link href="/demo">Live demo</Link>
              </li>
              <li>
                <Link href="/features">Features</Link>
              </li>
              <li>
                <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer">
                  Download Setup
                </a>
              </li>
              <li>
                <Link href="/beta">Desktop beta access</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="ux-section-label" style={{ marginBottom: "0.85rem" }}>
              Contact
            </p>
            <ul className="site-footer-links">
              <li>
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </li>
              <li>
                <Link href="/about">About the creator</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>
            © {new Date().getFullYear()} SmartBridge. Not affiliated with Yamaha
            Corporation.
          </span>
          <span>Tyros · Genos · PSR-SX · Motif</span>
        </div>
      </div>
    </footer>
  )
}
