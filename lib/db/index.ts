import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "@/lib/db/schema"

export type AppDatabase = NeonHttpDatabase<typeof schema>

let database: AppDatabase | undefined

function createDatabase(connectionString: string): AppDatabase {
  const sql = neon(connectionString)
  return drizzle(sql, { schema })
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not configured")
  }
  return url
}

export function getDb(): AppDatabase {
  if (!database) {
    database = createDatabase(getDatabaseUrl())
  }
  return database
}

export function createDb(connectionString: string): AppDatabase {
  return createDatabase(connectionString)
}

export function resetDbForTests(): void {
  database = undefined
}

export { schema }
