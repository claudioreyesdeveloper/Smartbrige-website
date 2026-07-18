import Link from "next/link"
import { ArrowUpRight, Lock } from "lucide-react"
import { CheckoutButton } from "@/components/billing/checkout-button"
import "@/components/billing/billing.css"
import { SERVICE_CATALOG } from "./service-catalog"
import type { ServiceKey } from "./types"

type UpgradeRequiredProps = {
  serviceKey: ServiceKey
}

export function UpgradeRequired({ serviceKey }: UpgradeRequiredProps) {
  const service = SERVICE_CATALOG[serviceKey]
  const billingHref = `/app/billing?service=${serviceKey}`

  return (
    <div className="app-shell-upgrade-panel" role="alert">
      <span className="app-shell-upgrade-icon" aria-hidden="true">
        <Lock size={24} />
      </span>
      <h2 className="app-shell-upgrade-title">{service.name} is not in your plan</h2>
      <p className="app-shell-upgrade-body">
        Subscribe to unlock {service.name.toLowerCase()}. Each service is billed independently —
        adding this module will not change your other subscriptions.
      </p>
      <div className="app-shell-upgrade-actions">
        <CheckoutButton
          serviceKey={serviceKey}
          label={`Subscribe to ${service.name}`}
          className="app-shell-btn app-shell-btn-accent"
        />
        <Link href={billingHref} className="app-shell-btn app-shell-btn-secondary">
          View billing options
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/app" className="app-shell-btn app-shell-btn-secondary">
          Back to overview
        </Link>
      </div>
    </div>
  )
}
