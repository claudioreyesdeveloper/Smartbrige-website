import Link from "next/link"
import { ArrowUpRight, Lock } from "lucide-react"
import { SERVICE_CATALOG } from "./service-catalog"
import { mockEntitlementProvider } from "./mock-entitlement-provider"
import type { ServiceKey } from "./types"

type UpgradeRequiredProps = {
  serviceKey: ServiceKey
}

export function UpgradeRequired({ serviceKey }: UpgradeRequiredProps) {
  const service = SERVICE_CATALOG[serviceKey]
  const upgradeHref = mockEntitlementProvider.getUpgradeHref(serviceKey)

  return (
    <div className="app-shell-upgrade-panel" role="alert">
      <span className="app-shell-upgrade-icon" aria-hidden="true">
        <Lock size={24} />
      </span>
      <h2 className="app-shell-upgrade-title">{service.name} is not in your plan</h2>
      <p className="app-shell-upgrade-body">
        Upgrade your subscription to unlock {service.name.toLowerCase()} and add it to your
        SmartBridge workflow.
      </p>
      <div className="app-shell-upgrade-actions">
        <a href={upgradeHref} className="app-shell-btn app-shell-btn-accent">
          View upgrade options
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        <Link href="/app" className="app-shell-btn app-shell-btn-secondary">
          Back to overview
        </Link>
      </div>
    </div>
  )
}
