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
            <p>One chord-aware song context across Yamaha hardware, performed MIDI, Cubase, Synthesizer V, and native style production.</p>
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
            <p className="site-footer-heading">Learn</p>
            <ul className="site-footer-links">
              <li><Link href="/about">Why SmartBridge</Link></li>
              <li><a href={`mailto:${SITE.email}`}>Contact Claudio</a></li>
              <li><Link href="/beta">Desktop beta <ArrowUpRight size={13} /></Link></li>
            </ul>
          </div>
          <div className="site-footer-cta">
            <p className="site-footer-heading">SmartBridge Desktop</p>
            <p>Build the song once, then carry its musical intelligence into the complete production.</p>
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
