"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  Lock,
  Music2,
  SlidersHorizontal,
  Wand2,
} from "lucide-react"
import { isPrimaryNavKey, type ServiceKey } from "@/lib/services/catalog"
import { isJamPlayerFamilyPath } from "./jam-player-routes"
import type { ServiceEntitlement } from "./types"

const SERVICE_ICONS: Partial<Record<ServiceKey, typeof Music2>> = {
  "jam-player": Music2,
  "genos-mixer": SlidersHorizontal,
  "style-maker": Wand2,
}

function isPrimaryNavActive(pathname: string, key: ServiceKey): boolean {
  if (key === "jam-player") return isJamPlayerFamilyPath(pathname)
  if (key === "genos-mixer") {
    return pathname === "/app/genos-mixer" || pathname.startsWith("/app/genos-mixer/")
  }
  return false
}

type ServiceNavProps = {
  entitlements: ServiceEntitlement[]
}

export function ServiceNav({ entitlements }: ServiceNavProps) {
  const pathname = usePathname()
  const primary = entitlements.filter(
    (service) => isPrimaryNavKey(service.key) && service.access === "active",
  )
  const unavailable = entitlements.filter(
    (service) =>
      (isPrimaryNavKey(service.key) || service.key === "style-maker") &&
      service.access !== "active",
  )

  return (
    <nav className="app-shell-nav" aria-label="SmartBridge services">
      <div className="app-shell-nav-primary">
        <Link
          href="/app"
          className={`app-shell-nav-item${pathname === "/app" ? " is-active" : ""}`}
          aria-current={pathname === "/app" ? "page" : undefined}
        >
          <LayoutGrid size={17} aria-hidden="true" />
          <span>Overview</span>
        </Link>

        <ul className="app-shell-nav-list">
          {primary.map((service) => {
            const Icon = SERVICE_ICONS[service.key] ?? Music2
            const isActive = isPrimaryNavActive(pathname, service.key)
            return (
              <li key={service.key}>
                <Link
                  href={service.path}
                  className={`app-shell-nav-item${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{service.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {unavailable.length > 0 ? (
        <ul className="app-shell-nav-list app-shell-nav-unavailable" aria-label="Other services">
          {unavailable.map((service) => {
            const Icon = SERVICE_ICONS[service.key] ?? Music2
            const isComingSoon = service.access === "coming-soon"

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

            return (
              <li key={service.key}>
                <a href={service.upgradeHref} className="app-shell-nav-item is-upgrade">
                  <Icon size={16} aria-hidden="true" />
                  <span>{service.name}</span>
                  <Lock size={12} aria-hidden="true" className="app-shell-nav-lock" />
                  <span className="visually-hidden"> — upgrade required</span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}
    </nav>
  )
}
