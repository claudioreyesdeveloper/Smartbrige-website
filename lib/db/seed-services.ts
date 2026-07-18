import { SERVICE_CATALOG } from "@/lib/db/services"
import { services } from "@/lib/db/schema"
import type { AppDatabase } from "@/lib/db"

export type ServiceSeedRow = typeof services.$inferInsert

export function buildServiceCatalogSeedRows(): ServiceSeedRow[] {
  return SERVICE_CATALOG.map((entry) => ({
    key: entry.key,
    name: entry.name,
    description: entry.description,
    availability: entry.availability,
    sortOrder: entry.sortOrder,
  }))
}

export async function seedServiceCatalog(db: AppDatabase): Promise<void> {
  const rows = buildServiceCatalogSeedRows()
  for (const row of rows) {
    await db
      .insert(services)
      .values(row)
      .onConflictDoUpdate({
        target: services.key,
        set: {
          name: row.name,
          description: row.description,
          availability: row.availability,
          sortOrder: row.sortOrder,
          updatedAt: new Date(),
        },
      })
  }
}
