import Link from "next/link"
import {
  ArrowUpRight,
  Clock3,
  Drum,
  Lock,
  Mic2,
  Music2,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react"
import type { ServiceEntitlement, ServiceKey } from "./types"

const SERVICE_ICONS: Record<ServiceKey, typeof Music2> = {
  "jam-player": Music2,
  "bass-drums": Drum,
  "solo-phrases": Sparkles,
  lyrics: Mic2,
  "genos-mixer": SlidersHorizontal,
  "style-maker": Wand2,
}

type ServiceCardProps = {
  service: ServiceEntitlement
}

export function ServiceCard({ service }: ServiceCardProps) {
  const Icon = SERVICE_ICONS[service.key]

  return (
    <article
      className={`app-shell-card app-shell-card--${service.access}`}
      aria-labelledby={`service-${service.key}-title`}
    >
      <header className="app-shell-card-header">
        <span className="app-shell-card-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
        <div>
          <p className="app-shell-card-tag">{service.tagline}</p>
          <h2 id={`service-${service.key}-title`} className="app-shell-card-title">
            {service.name}
          </h2>
        </div>
      </header>

      <p className="app-shell-card-body">{service.description}</p>

      <footer className="app-shell-card-footer">
        {service.access === "active" && (
          <Link href={service.path} className="app-shell-btn app-shell-btn-primary">
            Open workspace
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}

        {service.access === "upgrade" && (
          <>
            <span className="app-shell-status app-shell-status-upgrade">
              <Lock size={14} aria-hidden="true" />
              Not included in your plan
            </span>
            <a href={service.upgradeHref} className="app-shell-btn app-shell-btn-accent">
              Upgrade to unlock
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </>
        )}

        {service.access === "coming-soon" && (
          <>
            <span className="app-shell-status app-shell-status-soon">
              <Clock3 size={14} aria-hidden="true" />
              Coming soon
            </span>
            <button type="button" className="app-shell-btn app-shell-btn-muted" disabled>
              Not available yet
            </button>
          </>
        )}
      </footer>
    </article>
  )
}
