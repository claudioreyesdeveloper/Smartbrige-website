"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { SITE } from "@/lib/site"

const NAV = [
  { href: "/app", label: "Open app" },
  { href: "/demo", label: "Live demo" },
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/beta", label: "Beta access" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">SmartBridge</Link>

        <nav className="site-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-link${pathname === item.href ? " is-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={SITE.setupUrl}
            className="btn-primary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Setup
          </a>
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
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="site-nav-link"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={SITE.setupUrl}
            className="btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download Setup
          </a>
        </nav>
      )}
    </header>
  )
}
