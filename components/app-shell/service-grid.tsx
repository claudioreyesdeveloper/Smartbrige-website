"use client"

import { isJamChildServiceKey, isPrimaryNavKey } from "@/lib/services/catalog"
import { partitionEntitlements } from "./types"
import { useEntitlements } from "./entitlement-context"
import { ServiceCard } from "./service-card"

export function ServiceGrid() {
  const entitlements = useEntitlements()
  const { active, upgrade, comingSoon } = partitionEntitlements(entitlements)

  const primaryActive = active.filter((service) => isPrimaryNavKey(service.key))
  const jamTools = active.filter((service) => isJamChildServiceKey(service.key))
  const otherUpgrade = upgrade.filter((service) => !isJamChildServiceKey(service.key))
  const jamUpgrade = upgrade.filter((service) => isJamChildServiceKey(service.key))

  return (
    <div className="app-shell-dashboard">
      {primaryActive.length > 0 && (
        <section className="app-shell-section" aria-labelledby="active-services-heading">
          <h2 id="active-services-heading" className="app-shell-section-title">
            Your services
          </h2>
          <p className="app-shell-section-lead">
            Jam Player holds Song, Bass, Drums, Solo, and Lyrics. Genos Mixer is the live mix desk.
          </p>
          <ul className="app-shell-card-grid">
            {primaryActive.map((service) => (
              <li key={service.key}>
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {jamTools.length > 0 && (
        <section className="app-shell-section" aria-labelledby="jam-tools-heading">
          <h2 id="jam-tools-heading" className="app-shell-section-title">
            Inside Jam Player
          </h2>
          <p className="app-shell-section-lead">
            Jump straight into a Jam Player tool. These stay under the Jam Player tab while you work.
          </p>
          <ul className="app-shell-card-grid">
            {jamTools.map((service) => (
              <li key={service.key}>
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(otherUpgrade.length > 0 || jamUpgrade.length > 0) && (
        <section className="app-shell-section" aria-labelledby="upgrade-services-heading">
          <h2 id="upgrade-services-heading" className="app-shell-section-title">
            Upgrade to unlock
          </h2>
          <p className="app-shell-section-lead">
            Add modules to your subscription when you are ready to expand your workflow.
          </p>
          <ul className="app-shell-card-grid">
            {[...jamUpgrade, ...otherUpgrade].map((service) => (
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
