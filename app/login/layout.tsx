import { AuthProvider } from "@/components/auth/auth-provider"
import type { ReactNode } from "react"

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
