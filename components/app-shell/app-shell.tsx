"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { EntitlementProviderBoundary, useEntitlements } from "./entitlement-context"
import { ServiceNav } from "./service-nav"

type AppShellFrameProps = {
  children: ReactNode
}

function AppShellFrame({ children }: AppShellFrameProps) {
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
              ) : (
                <>
                  <p className="app-shell-topbar-eyebrow">Subscription</p>
                  <h1 className="app-shell-topbar-title">Service overview</h1>
                </>
              )}
            </div>
            <p className="app-shell-topbar-note" role="status">
              Signed-in workspace preview — billing connects in a later release.
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
}

export function AppShell({ children }: AppShellProps) {
  return (
    <EntitlementProviderBoundary>
      <AppShellFrame>{children}</AppShellFrame>
    </EntitlementProviderBoundary>
  )
}
