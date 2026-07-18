import Link from "next/link"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { PortalButton } from "@/components/billing/portal-button"
import type { AccountServiceRow } from "@/lib/access"
import "@/components/billing/billing.css"

type AccountPanelProps = {
  email: string | null
  rows: AccountServiceRow[]
}

function statusLabel(row: AccountServiceRow): string {
  if (row.access === "coming-soon") {
    return "Coming soon"
  }
  if (row.access === "active") {
    if (row.entitlementStatus === "trialing") {
      return "Trialing"
    }
    return "Active"
  }
  if (row.entitlementStatus === "canceled") {
    return "Canceled"
  }
  if (row.entitlementStatus === "expired") {
    return "Expired"
  }
  return "Not subscribed"
}

export function AccountPanel({ email, rows }: AccountPanelProps) {
  return (
    <section className="billing-panel" aria-labelledby="account-heading">
      <div className="billing-panel-header">
        <div>
          <p className="app-shell-topbar-eyebrow">Account</p>
          <h2 id="account-heading" className="billing-panel-title">
            Subscriptions
          </h2>
          <p className="billing-panel-copy">
            Each service is independent. Canceling one subscription does not remove access to
            your other active services.
          </p>
          {email ? (
            <p className="billing-service-status">Signed in as {email}</p>
          ) : (
            <p className="billing-service-status">Signed-in workspace</p>
          )}
        </div>
        <PortalButton label="Manage in Stripe portal" />
      </div>

      <ul className="billing-service-list">
        {rows.map((row) => {
          const purchasable = row.access === "upgrade"
          return (
            <li key={row.key} className="billing-service-card">
              <div>
                <h3 className="billing-service-name">{row.name}</h3>
                <p className="billing-service-copy">{row.description}</p>
                <p className="billing-service-status">{statusLabel(row)}</p>
              </div>
              <div className="billing-action">
                {row.access === "active" ? (
                  <Link href={row.path} className="app-shell-btn app-shell-btn-primary">
                    Open workspace
                  </Link>
                ) : null}
                {purchasable ? (
                  <CheckoutButton
                    serviceKey={row.key}
                    label={`Subscribe to ${row.name}`}
                  />
                ) : null}
                {row.access === "coming-soon" ? (
                  <button type="button" className="app-shell-btn app-shell-btn-secondary" disabled>
                    Unavailable
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
