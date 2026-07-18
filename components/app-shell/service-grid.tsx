"use client"

import { partitionEntitlements } from "./types"
import { useEntitlements } from "./entitlement-context"
import { ServiceCard } from "./service-card"

export function ServiceGrid() {
  const entitlements = useEntitlements()
  const { active, upgrade, comingSoon } = partitionEntitlements(entitlements)

  return (
    <div className="app-shell-dashboard">
      {active.length > 0 && (
        <section className="app-shell-section" aria-labelledby="active-services-heading">
          <h2 id="active-services-heading" className="app-shell-section-title">
            Your services
          </h2>
          <p className="app-shell-section-lead">
            Open a workspace to continue where you left off.
          </p>
          <ul className="app-shell-card-grid">
            {active.map((service) => (
              <li key={service.key}>
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {upgrade.length > 0 && (
        <section className="app-shell-section" aria-labelledby="upgrade-services-heading">
          <h2 id="upgrade-services-heading" className="app-shell-section-title">
            Upgrade to unlock
          </h2>
          <p className="app-shell-section-lead">
            Add modules to your subscription when you are ready to expand your workflow.
          </p>
          <ul className="app-shell-card-grid">
            {upgrade.map((service) => (
              <li key={service.key}>
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {comingSoon.length > 0 && (
        <section className="app-shell-section" aria-labelledby="future-services-heading">
          <h2 id="future-services-heading" className="app-shell-section-title">
            On the roadmap
          </h2>
          <p className="app-shell-section-lead">
            Preview what is next — these modules are not available to purchase yet.
          </p>
          <ul className="app-shell-card-grid">
            {comingSoon.map((service) => (
              <li key={service.key}>
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
