import { notFound } from "next/navigation"
import { requireAppAccessContext } from "@/lib/access"
import { userHasServiceAccess } from "@/lib/auth/entitlement-logic"
import { getSharedServiceCatalogEntry } from "@/lib/services/catalog"
import { UpgradeRequired } from "./upgrade-required"
import type { ServiceKey } from "./types"
import type { ReactNode } from "react"

type ServiceAccessGateProps = {
  serviceKey: ServiceKey
  children: ReactNode
}

/**
 * Server-side per-service gate. Middleware alone is insufficient — this re-checks
 * the Auth.js (or test fixture) session and entitlement records.
 */
export async function ServiceAccessGate({ serviceKey, children }: ServiceAccessGateProps) {
  if (getSharedServiceCatalogEntry(serviceKey).availability === "future") {
    notFound()
  }

  const access = await requireAppAccessContext(`/app/${serviceKey}`)
  if (!userHasServiceAccess(access.records, serviceKey)) {
    return <UpgradeRequired serviceKey={serviceKey} />
  }

  return <>{children}</>
}
