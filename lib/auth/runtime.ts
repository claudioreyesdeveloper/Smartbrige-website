import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { cookies } from "next/headers"
import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"
import {
  ACCESS_FIXTURE_COOKIE,
  parseAccessFixtureCookie,
} from "@/lib/access/fixture"
import { getDb } from "@/lib/db"
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema"

type AuthExports = ReturnType<typeof NextAuth>

let authExports: AuthExports | undefined

function createAuthExports(): AuthExports {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured")
  }

  const from = process.env.AUTH_EMAIL_FROM
  if (!from) {
    throw new Error("AUTH_EMAIL_FROM is not configured")
  }

  return NextAuth({
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    providers: [
      Resend({
        from,
        apiKey: process.env.RESEND_API_KEY,
      }),
    ],
    pages: {
      signIn: "/login",
      verifyRequest: "/verify-request",
    },
    session: {
      strategy: "database",
    },
    secret,
    trustHost: true,
  })
}

export function getAuthExports(): AuthExports {
  if (!authExports) {
    authExports = createAuthExports()
  }
  return authExports
}

export async function auth() {
  return getAuthExports().auth()
}

export async function signIn(...args: Parameters<AuthExports["signIn"]>) {
  return getAuthExports().signIn(...args)
}

export async function signOut(...args: Parameters<AuthExports["signOut"]>) {
  return getAuthExports().signOut(...args)
}

async function readFixtureUserId(): Promise<string | null> {
  try {
    const jar = await cookies()
    return parseAccessFixtureCookie(jar.get(ACCESS_FIXTURE_COOKIE)?.value)?.userId ?? null
  } catch {
    return null
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const fixtureUserId = await readFixtureUserId()
  if (fixtureUserId) {
    return fixtureUserId
  }
  const session = await auth()
  return session?.user?.id ?? null
}

export async function requireSessionUserId(): Promise<string> {
  const userId = await getSessionUserId()
  if (!userId) {
    throw new Error("Authentication is required.")
  }
  return userId
}
