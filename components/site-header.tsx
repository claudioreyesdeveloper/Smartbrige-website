"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { SITE } from "@/lib/site"

const NAV = [
  { href: "/style-maker", label: "Style Maker" },
  { href: "/jam-player", label: "Jam Player" },
  { href: "/demo", label: "Live demo" },
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/beta", label: "Beta access" },
  { href: SITE.setupUrl, label: "Download Setup", external: true },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isJamPlayerApp = pathname === "/jam-player/app"

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))

  if (isJamPlayerApp) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-white/10 bg-[#0a0a0a]/95 px-4 backdrop-blur-xl">
        <Link href="/jam-player" className="flex items-center gap-3 text-sm text-white">
          <span className="flex size-8 items-center justify-center rounded-lg border border-orange-400/30 bg-orange-500/10 font-semibold text-orange-300">
            SB
          </span>
          <span>
            <span className="block text-[10px] leading-none tracking-[0.18em] text-white/40 uppercase">
              SmartBridge
            </span>
            <span className="mt-1 block leading-none font-medium">Jam Player</span>
          </span>
        </Link>
        <Link
          href="/jam-player"
          className="ml-auto rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
        >
          Exit player
        </Link>
      </header>
    )
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          SmartBridge
        </Link>

        <nav className="site-nav" aria-label="Main">
          {NAV.map((item) =>
            "external" in item && item.external ? (
              <a
                key={item.href}
                href={item.href}
                className="site-nav-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`site-nav-link${isActive(item.href) ? " is-active" : ""}`}
              >
                {item.label}
              </Link>
            ),
          )}
          <Link
            href="/style-maker"
            className="btn-primary"
            style={{ padding: "0.65rem 1.1rem", fontSize: "0.875rem", minHeight: "2.75rem" }}
          >
            Try Style Maker
          </Link>
        </nav>

        <button
          type="button"
          className="site-menu-btn"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav className="site-nav-mobile" aria-label="Mobile">
          {NAV.map((item) =>
            "external" in item && item.external ? (
              <a
                key={item.href}
                href={item.href}
                className="site-nav-link"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`site-nav-link${isActive(item.href) ? " is-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ),
          )}
          <Link
            href="/style-maker"
            className="btn-primary"
            onClick={() => setOpen(false)}
          >
            Try Style Maker
          </Link>
        </nav>
      )}
    </header>
  )
}
