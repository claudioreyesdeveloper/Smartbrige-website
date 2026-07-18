"use client"

import { useState, type FormEvent } from "react"
import { signIn } from "next-auth/react"
import { VERIFY_REQUEST_PATH } from "@/lib/auth/verify-request"

type SignInFormProps = {
  callbackUrl?: string
}

export function SignInForm({ callbackUrl = "/" }: SignInFormProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      const result = await signIn("resend", {
        email,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError("We could not send a sign-in link. Check the email address and try again.")
        return
      }

      window.location.assign(VERIFY_REQUEST_PATH)
    } catch {
      setError("Something went wrong while requesting a sign-in link.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-200">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-stone-100 outline-none focus:border-[var(--color-accent)]"
          placeholder="you@example.com"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  )
}
