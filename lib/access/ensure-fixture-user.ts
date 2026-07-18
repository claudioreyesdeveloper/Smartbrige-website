import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { users } from "@/lib/db/schema"

/**
 * Preview fixture cookies use synthetic user ids that are not created by Auth.js.
 * Projects and blob ownership require a real `user` row — upsert on fixture access.
 */
export async function ensureFixtureUserExists(input: {
  userId: string
  email: string | null
}): Promise<void> {
  const db = getDb()
  const existing = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { id: true },
  })
  if (existing) return

  const email = input.email?.trim() || `${input.userId}@fixture.thesmartbridge.io`
  const now = new Date()
  await db
    .insert(users)
    .values({
      id: input.userId,
      name: "Preview User",
      email,
      emailVerified: null,
      image: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: users.id })
}
