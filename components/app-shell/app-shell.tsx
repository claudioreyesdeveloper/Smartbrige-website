"use client"

import Link from "next/link"
import { useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AppKeyboardBar } from "@/components/keyboard/app-keyboard-bar"
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
        <header className="app-shell-header">
          <div className="app-shell-header-primary">
            <div className="app-shell-brand">
              <Link href="/app" className="app-shell-brand-link">
                SmartBridge
              </Link>
              <span className="app-shell-brand-badge">App</span>
            </div>

            <ServiceNav entitlements={entitlements} />

            <nav className="app-shell-utility-nav" aria-label="Account and support">
              <Link
                href="/app/settings"
                className={`app-shell-utility-link${pathname === "/app/settings" ? " is-active" : ""}`}
                aria-current={pathname === "/app/settings" ? "page" : undefined}
              >
                Settings
              </Link>
              <Link
                href="/app/account"
                className={`app-shell-utility-link${pathname === "/app/account" ? " is-active" : ""}`}
                aria-current={pathname === "/app/account" ? "page" : undefined}
              >
                Account
              </Link>
              <Link
                href="/app/billing"
                className={`app-shell-utility-link${pathname.startsWith("/app/billing") ? " is-active" : ""}`}
                aria-current={pathname.startsWith("/app/billing") ? "page" : undefined}
              >
                Billing
              </Link>
              <Link href="/demo" className="app-shell-utility-link">
                Public demo
              </Link>
              <Link href="/" className="app-shell-utility-link">
                Website
              </Link>
            </nav>
          </div>

          <div className="app-shell-context-bar">
            <div>
              {activeService ? (
                <>
                  <p className="app-shell-topbar-eyebrow">{activeService.tagline}</p>
                  <h1 className="app-shell-topbar-title">{activeService.name}</h1>
                </>
              ) : pathname === "/app/settings" ? (
                <>
                  <p className="app-shell-topbar-eyebrow">Workspace</p>
                  <h1 className="app-shell-topbar-title">Settings</h1>
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
            <div className="app-shell-topbar-aside">
              <AppKeyboardBar />
              <p className="app-shell-topbar-note" role="status">
                {email ? `Signed in as ${email}` : "Signed-in workspace"}
              </p>
            </div>
          </div>
        </header>

        <main id="app-shell-main" className="app-shell-main">
          {children}
        </main>
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
