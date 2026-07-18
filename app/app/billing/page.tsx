import type { Metadata } from "next"
import { BillingPanel } from "@/components/billing/billing-panel"
import { isServiceKey, type ServiceKey } from "@/lib/services/catalog"

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage independent SmartBridge service subscriptions.",
  robots: { index: false, follow: false },
}

type BillingPageProps = {
  searchParams?: Promise<{ service?: string }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = (await searchParams) ?? {}
  const highlightService: ServiceKey | null =
    typeof params.service === "string" && isServiceKey(params.service) ? params.service : null

  return <BillingPanel highlightService={highlightService} />
}
