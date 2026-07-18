import type { Metadata } from "next"
import { SignInForm } from "@/components/auth/sign-in-form"
import { sanitizeCallbackUrl } from "@/lib/access"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to SmartBridge with a secure email link.",
}

type LoginPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {}
  const callbackUrl = sanitizeCallbackUrl(
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/app",
    "/app",
  )

  return (
    <div className="page-shell">
      <div className="content-wrap max-w-lg">
        <p className="section-label">Account</p>
        <h1 className="section-title mt-3">Sign in to SmartBridge</h1>
        <p className="mt-4 prose-muted">
          Enter your email and we&apos;ll send a one-time sign-in link. No password required.
        </p>

        <div className="card-surface mt-8 p-8">
          <SignInForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </div>
  )
}
