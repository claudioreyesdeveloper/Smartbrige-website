import type { Metadata } from "next"
import { AccountPanel } from "@/components/account/account-panel"
import { requireAppAccessContext } from "@/lib/access"

export const metadata: Metadata = {
  title: "Account",
  description: "Independent SmartBridge service subscription status.",
  robots: { index: false, follow: false },
}

export default async function AccountPage() {
  const access = await requireAppAccessContext("/app/account")
  return <AccountPanel email={access.email} rows={access.accountRows} />
}
