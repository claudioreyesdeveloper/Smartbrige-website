import type { Metadata } from "next"
import { StyleMakerAdmin } from "@/components/admin/style-maker-admin"

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <StyleMakerAdmin />
}
