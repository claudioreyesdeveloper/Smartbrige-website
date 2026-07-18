import type { Metadata } from "next"
import Link from "next/link"
import { Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Check your email",
  description: "Complete SmartBridge sign-in from the link we sent to your inbox.",
}

type VerifyRequestPageProps = {
  searchParams: Promise<{ email?: string }>
}

export default async function VerifyRequestPage({ searchParams }: VerifyRequestPageProps) {
  const params = await searchParams
  const email = params.email?.trim()

  return (
    <div className="page-shell">
      <div className="content-wrap max-w-lg">
        <div className="card-surface p-8">
          <Mail size={24} className="text-[var(--color-accent)]" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold text-stone-50">Check your email</h1>
          <p className="mt-3 prose-muted">
            {email
              ? `We sent a sign-in link to ${email}. Open it on this device to finish signing in.`
              : "We sent a sign-in link to your inbox. Open it on this device to finish signing in."}
          </p>
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
