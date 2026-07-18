import type { Metadata } from "next"
import { AppShell } from "@/components/app-shell/app-shell"
import "./app-shell.css"

export const metadata: Metadata = {
  title: "SmartBridge App",
  description: "Your SmartBridge subscription workspace and service modules.",
  robots: { index: false, follow: false },
}

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppShell>{children}</AppShell>
}
