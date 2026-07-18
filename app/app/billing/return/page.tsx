import type { Metadata } from "next"
import Link from "next/link"
import { isServiceKey } from "@/lib/services/catalog"
import "@/components/billing/billing.css"

export const metadata: Metadata = {
  title: "Checkout return",
  robots: { index: false, follow: false },
}

type ReturnPageProps = {
  searchParams?: Promise<{
    status?: string
    service?: string
    session_id?: string
  }>
}

export default async function BillingReturnPage({ searchParams }: ReturnPageProps) {
  const params = (await searchParams) ?? {}
  const status = params.status === "success" ? "success" : "cancelled"
  const serviceLabel =
    typeof params.service === "string" && isServiceKey(params.service)
      ? params.service
      : "your selected service"

  return (
    <section className="billing-return" aria-labelledby="billing-return-heading">
      <p className="app-shell-topbar-eyebrow">Checkout</p>
      <h2 id="billing-return-heading" className="billing-panel-title">
        {status === "success" ? "Subscription started" : "Checkout cancelled"}
      </h2>
      <p className="billing-panel-copy">
        {status === "success"
          ? `Stripe accepted checkout for ${serviceLabel}. Entitlements update after the signed webhook is processed — usually within a few seconds.`
          : `No charge was made for ${serviceLabel}. You can restart checkout whenever you are ready.`}
      </p>
      {params.session_id ? (
        <p className="billing-service-status">Checkout session reference recorded.</p>
      ) : null}
      <div className="billing-return-actions">
        <Link href="/app/billing" className="app-shell-btn app-shell-btn-accent">
          Back to billing
        </Link>
        <Link href="/app" className="app-shell-btn app-shell-btn-secondary">
          Service overview
        </Link>
      </div>
    </section>
  )
}
