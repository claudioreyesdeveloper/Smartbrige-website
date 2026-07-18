"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Drum,
  LayoutGrid,
  Lock,
  Music2,
  Mic2,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react"
import type { ServiceEntitlement, ServiceKey } from "./types"

const SERVICE_ICONS: Record<ServiceKey, typeof Music2> = {
  "jam-player": Music2,
  "bass-drums": Drum,
  "solo-phrases": Sparkles,
  lyrics: Mic2,
  "genos-mixer": SlidersHorizontal,
  "style-maker": Wand2,
}

type ServiceNavProps = {
  entitlements: ServiceEntitlement[]
}

export function ServiceNav({ entitlements }: ServiceNavProps) {
  const pathname = usePathname()

  return (
    <nav className="app-shell-nav" aria-label="SmartBridge services">
      <Link
        href="/app"
        className={`app-shell-nav-item${pathname === "/app" ? " is-active" : ""}`}
        aria-current={pathname === "/app" ? "page" : undefined}
      >
        <LayoutGrid size={18} aria-hidden="true" />
        <span>Overview</span>
      </Link>

      <ul className="app-shell-nav-list">
        {entitlements.map((service) => {
          const Icon = SERVICE_ICONS[service.key]
          const isActive = service.access === "active" && pathname === service.path
          const isComingSoon = service.access === "coming-soon"
          const isUpgrade = service.access === "upgrade"

          if (isComingSoon) {
            return (
              <li key={service.key}>
                <span
                  className="app-shell-nav-item is-disabled"
                  aria-disabled="true"
                  title={`${service.name} is coming soon`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{service.name}</span>
                  <span className="app-shell-nav-badge">Soon</span>
                </span>
              </li>
            )
          }

          if (isUpgrade) {
            return (
              <li key={service.key}>
                <a
                  href={service.upgradeHref}
                  className="app-shell-nav-item is-upgrade"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{service.name}</span>
                  <Lock size={14} aria-hidden="true" className="app-shell-nav-lock" />
                  <span className="visually-hidden"> — upgrade required</span>
                </a>
              </li>
            )
          }

          return (
            <li key={service.key}>
              <Link
                href={service.path}
                className={`app-shell-nav-item${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{service.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
