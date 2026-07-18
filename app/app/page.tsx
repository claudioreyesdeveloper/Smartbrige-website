import type { Metadata } from "next"
import { ServiceGrid } from "@/components/app-shell/service-grid"

export const metadata: Metadata = {
  title: "Service overview",
}

export default function AppOverviewPage() {
  return <ServiceGrid />
}
