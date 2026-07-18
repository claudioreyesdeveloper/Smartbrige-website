"use client"

import Link from "next/link"
import { useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { EntitlementProviderBoundary, useEntitlements } from "./entitlement-context"
import { ServiceNav } from "./service-nav"
import { StaticEntitlementProvider } from "./static-entitlement-provider"
import type { ServiceEntitlement } from "./types"

type AppShellFrameProps = {
  children: ReactNode
  email: string | null
}

function AppShellFrame({ children, email }: AppShellFrameProps) {
  const entitlements = useEntitlements()
  const pathname = usePathname()
  const activeService = entitlements.find(
    (service) => service.access === "active" && service.path === pathname,
  )

  return (
    <div className="app-shell-root">
      <a href="#app-shell-main" className="app-shell-skip">
        Skip to main content
      </a>

      <div className="app-shell-layout">
        <aside className="app-shell-sidebar" aria-label="Application">
          <div className="app-shell-brand">
            <Link href="/app" className="app-shell-brand-link">
              SmartBridge
            </Link>
            <span className="app-shell-brand-badge">App</span>
          </div>

          <ServiceNav entitlements={entitlements} />

          <div className="app-shell-sidebar-foot">
            <Link
              href="/app/account"
              className={`app-shell-sidebar-link${pathname === "/app/account" ? " is-active" : ""}`}
            >
              Account
            </Link>
            <Link
              href="/app/billing"
              className={`app-shell-sidebar-link${pathname.startsWith("/app/billing") ? " is-active" : ""}`}
            >
              Billing
            </Link>
            <Link href="/" className="app-shell-sidebar-link">
              Marketing site
            </Link>
            <Link href="/demo" className="app-shell-sidebar-link">
              Public demo
            </Link>
          </div>
        </aside>

        <div className="app-shell-main-column">
          <header className="app-shell-topbar">
            <div>
              {activeService ? (
                <>
                  <p className="app-shell-topbar-eyebrow">{activeService.tagline}</p>
                  <h1 className="app-shell-topbar-title">{activeService.name}</h1>
                </>
              ) : pathname === "/app/account" ? (
                <>
                  <p className="app-shell-topbar-eyebrow">Account</p>
                  <h1 className="app-shell-topbar-title">Subscriptions</h1>
                </>
              ) : pathname.startsWith("/app/billing") ? (
                <>
                  <p className="app-shell-topbar-eyebrow">Billing</p>
                  <h1 className="app-shell-topbar-title">Checkout & portal</h1>
                </>
              ) : (
                <>
                  <p className="app-shell-topbar-eyebrow">Subscription</p>
                  <h1 className="app-shell-topbar-title">Service overview</h1>
                </>
              )}
            </div>
            <p className="app-shell-topbar-note" role="status">
              {email ? `Signed in as ${email}` : "Signed-in workspace"}
            </p>
          </header>

          <main id="app-shell-main" className="app-shell-main">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

type AppShellProps = {
  children: ReactNode
  entitlements: ServiceEntitlement[]
  email?: string | null
}

export function AppShell({ children, entitlements, email = null }: AppShellProps) {
  const provider = useMemo(
    () => new StaticEntitlementProvider(entitlements),
    [entitlements],
  )

  return (
    <EntitlementProviderBoundary provider={provider}>
      <AppShellFrame email={email}>{children}</AppShellFrame>
    </EntitlementProviderBoundary>
  )
}
