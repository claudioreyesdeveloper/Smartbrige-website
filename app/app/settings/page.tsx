import type { Metadata } from "next"
import { SettingsWorkspace } from "@/components/keyboard/settings-workspace"
import { requireAppAccessContext } from "@/lib/access"

export const metadata: Metadata = {
  title: "Settings",
  description: "Global SmartBridge keyboard connection settings for all paid features.",
  robots: { index: false, follow: false },
}

export default async function SettingsPage() {
  await requireAppAccessContext("/app/settings")
  return <SettingsWorkspace />
}
