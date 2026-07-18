import type { Metadata } from "next"
import { SignInForm } from "@/components/auth/sign-in-form"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to SmartBridge with a secure email link.",
}

export default function LoginPage() {
  return (
    <div className="page-shell">
      <div className="content-wrap max-w-lg">
        <p className="section-label">Account</p>
        <h1 className="section-title mt-3">Sign in to SmartBridge</h1>
        <p className="mt-4 prose-muted">
          Enter your email and we&apos;ll send a one-time sign-in link. No password required.
        </p>

        <div className="card-surface mt-8 p-8">
          <SignInForm />
        </div>
      </div>
    </div>
  )
}
