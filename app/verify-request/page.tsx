import type { Metadata } from "next"
import Link from "next/link"
import { Mail } from "lucide-react"
import { VERIFY_REQUEST_CONFIRMATION } from "@/lib/auth/verify-request"

export const metadata: Metadata = {
  title: "Check your email",
  description: "Complete SmartBridge sign-in from the link we sent to your inbox.",
}

export default function VerifyRequestPage() {
  return (
    <div className="page-shell">
      <div className="content-wrap max-w-lg">
        <div className="card-surface p-8">
          <Mail size={24} className="text-[var(--color-accent)]" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold text-stone-50">Check your email</h1>
          <p className="mt-3 prose-muted">{VERIFY_REQUEST_CONFIRMATION}</p>
          <p className="mt-4 text-sm text-stone-400">
            The link expires shortly. If you do not see the message, check spam or request a new link.
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-flex">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
