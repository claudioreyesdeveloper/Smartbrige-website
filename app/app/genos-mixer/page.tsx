import type { Metadata } from "next"
import { PlaceholderWorkspace } from "@/components/app-shell/placeholder-workspace"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"

const service = SERVICE_CATALOG["genos-mixer"]

export const metadata: Metadata = {
  title: service.name,
}

export default function GenosMixerAppPage() {
  return (
    <PlaceholderWorkspace
      title={service.name}
      description={service.description}
    />
  )
}
