import type { Metadata } from "next"
import { AppShell } from "@/components/app-shell/app-shell"
import { requireAppAccessContext } from "@/lib/access"
import "./app-shell.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "SmartBridge App",
  description: "Your SmartBridge subscription workspace and service modules.",
  robots: { index: false, follow: false },
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const access = await requireAppAccessContext("/app")

  return (
    <AppShell entitlements={access.entitlements} email={access.email}>
      {children}
    </AppShell>
  )
}
