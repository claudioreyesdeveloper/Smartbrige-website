"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowUpRight, Menu, X } from "lucide-react"
import { SITE } from "@/lib/site"

const NAV = [
  { href: "/features", label: "Desktop" },
  { href: "/style-maker", label: "Style Maker" },
  { href: "/jam-player", label: "Jam Player" },
  { href: "/about", label: "Why SmartBridge" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isJamPlayerApp = pathname === "/jam-player/app"

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open])

  if (isJamPlayerApp) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-white/10 bg-[#0d0f0c]/95 px-4 backdrop-blur-xl">
        <Link href="/jam-player" className="flex items-center gap-3 text-sm text-white">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#c9f46a] text-xs font-black text-[#151712]">SB</span>
          <span>
            <span className="block text-[9px] leading-none tracking-[0.18em] text-white/40 uppercase">SmartBridge</span>
            <span className="mt-1 block leading-none font-medium">Jam Player</span>
          </span>
        </Link>
        <Link href="/jam-player" className="ml-auto rounded-full border border-white/15 px-3 py-2 text-xs text-white/65 transition hover:text-white">Exit player</Link>
      </header>
    )
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo" aria-label="SmartBridge home">
          <span>SB</span>
          <strong>SmartBridge</strong>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`site-nav-link${isActive(item.href) ? " is-active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-actions">
          <Link href="/style-maker" className="site-sign-in">Try Style Maker</Link>
          <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-primary m-button-nav">
            Get SmartBridge Desktop <ArrowUpRight size={15} />
          </a>
        </div>

        <button
          type="button"
          className="site-menu-btn"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="site-mobile-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav id="site-mobile-navigation" className="site-nav-mobile" aria-label="Mobile navigation">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`site-nav-link${isActive(item.href) ? " is-active" : ""}`} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href="/style-maker" className="site-nav-link" onClick={() => setOpen(false)}>Try Style Maker</Link>
          <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-primary" onClick={() => setOpen(false)}>
            Get Desktop <ArrowUpRight size={15} />
          </a>
        </nav>
      )}
    </header>
  )
}
