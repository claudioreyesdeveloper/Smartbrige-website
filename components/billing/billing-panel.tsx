import { CheckoutButton } from "@/components/billing/checkout-button"
import { PortalButton } from "@/components/billing/portal-button"
import { SHARED_SERVICE_CATALOG, type ServiceKey } from "@/lib/services/catalog"
import "./billing.css"

type BillingPanelProps = {
  highlightService?: ServiceKey | null
}

export function BillingPanel({ highlightService = null }: BillingPanelProps) {
  return (
    <section className="billing-panel" aria-labelledby="billing-heading">
      <div className="billing-panel-header">
        <div>
          <p className="app-shell-topbar-eyebrow">Billing</p>
          <h2 id="billing-heading" className="billing-panel-title">
            Independent service subscriptions
          </h2>
          <p className="billing-panel-copy">
            Each SmartBridge service is billed separately. Subscribe only to what you need, and
            cancel one service without affecting the others.
          </p>
        </div>
        <PortalButton />
      </div>

      <ul className="billing-service-list">
        {SHARED_SERVICE_CATALOG.map((service) => {
          const purchasable = service.availability === "active"
          const highlighted = highlightService === service.key
          return (
            <li
              key={service.key}
              className={
                highlighted ? "billing-service-card billing-service-card-highlight" : "billing-service-card"
              }
            >
              <div>
                <h3 className="billing-service-name">{service.name}</h3>
                <p className="billing-service-copy">{service.description}</p>
                {!purchasable ? (
                  <p className="billing-service-status">Coming soon — checkout unavailable.</p>
                ) : null}
              </div>
              {purchasable ? (
                <CheckoutButton serviceKey={service.key} label={`Subscribe to ${service.name}`} />
              ) : (
                <button type="button" className="app-shell-btn app-shell-btn-secondary" disabled>
                  Unavailable
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
