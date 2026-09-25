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
            <p>One song context connected through Yamaha hardware, performed MIDI, Cubase, Synthesizer V, solos, vocals and harmony.</p>
          </div>
          <div>
            <p className="site-footer-heading">Explore</p>
            <ul className="site-footer-links">
              <li><Link href="/explore">SmartBridge workflows</Link></li>
              <li><Link href="/build-with-us">Build with us</Link></li>
              <li><Link href="/style-maker">Style Maker</Link></li>
              <li><Link href="/jam-player">Jam Player</Link></li>
            </ul>
          </div>
          <div>
            <p className="site-footer-heading">Resources</p>
            <ul className="site-footer-links">
              <li><Link href="/about">Why SmartBridge</Link></li>
              <li><Link href="/manual">Desktop product manual</Link></li>
              <li><a href={`mailto:${SITE.email}`}>Contact Claudio</a></li>
              <li><Link href="/beta">Desktop beta <ArrowUpRight size={13} /></Link></li>
            </ul>
          </div>
          <div className="site-footer-cta">
            <p className="site-footer-heading">SmartBridge Desktop</p>
            <p>Watch the current workflows and help me decide what SmartBridge should improve, simplify or build next.</p>
            <Link href="/explore" className="m-button m-button-primary">Explore and help shape it <ArrowUpRight size={15} /></Link>
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
