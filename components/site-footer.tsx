"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { SITE } from "@/lib/site"

export function SiteFooter() {
  const pathname = usePathname()
  if (pathname === "/jam-player/app") return null

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link href="/" className="site-logo site-logo-footer"><span>SB</span><strong>SmartBridge</strong></Link>
            <p>One connected creative workflow for Yamaha keyboards, song building, and production.</p>
          </div>
          <div>
            <p className="site-footer-heading">Products</p>
            <ul className="site-footer-links">
              <li><Link href="/features">SmartBridge Desktop</Link></li>
              <li><Link href="/style-maker">Style Maker</Link></li>
              <li><Link href="/jam-player">Jam Player</Link></li>
            </ul>
          </div>
          <div>
            <p className="site-footer-heading">Company</p>
            <ul className="site-footer-links">
              <li><Link href="/about">About Claudio</Link></li>
              <li><a href={`mailto:${SITE.email}`}>Contact</a></li>
              <li><Link href="/beta">Beta program <ArrowUpRight size={13} /></Link></li>
            </ul>
          </div>
          <div className="site-footer-cta">
            <p className="site-footer-heading">SmartBridge Desktop</p>
            <p>Explore the complete keyboard-to-production workflow or request beta access.</p>
            <Link href="/features" className="m-button m-button-primary">Explore Desktop <ArrowUpRight size={15} /></Link>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} SmartBridge by Claudio Reyes.</span>
          <span>Independent software · Not affiliated with Yamaha Corporation.</span>
        </div>
      </div>
    </footer>
  )
}
