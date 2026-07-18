import { and, eq } from "drizzle-orm"
import { getDb, type AppDatabase } from "@/lib/db"
import { blobReferences } from "@/lib/db/schema"
import type { BlobPurpose, BlobReferenceRecord, BlobReferenceStore } from "@/lib/storage/types"

function mapRow(row: typeof blobReferences.$inferSelect): BlobReferenceRecord {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    storageKey: row.storageKey,
    contentType: row.contentType,
    byteSize: row.byteSize,
    checksumSha256: row.checksumSha256,
    purpose: row.purpose,
    createdAt: row.createdAt,
  }
}

export function createDrizzleBlobReferenceStore(db: AppDatabase = getDb()): BlobReferenceStore {
  return {
    async findById(id) {
      const row = await db.query.blobReferences.findFirst({
        where: eq(blobReferences.id, id),
      })
      return row ? mapRow(row) : null
    },

    async findByStorageKey(storageKey) {
      const row = await db.query.blobReferences.findFirst({
        where: eq(blobReferences.storageKey, storageKey),
      })
      return row ? mapRow(row) : null
    },

    async findByUserAndChecksum(userId, checksumSha256, purpose) {
      const row = await db.query.blobReferences.findFirst({
        where: and(
          eq(blobReferences.userId, userId),
          eq(blobReferences.checksumSha256, checksumSha256),
          eq(blobReferences.purpose, purpose),
        ),
      })
      return row ? mapRow(row) : null
    },

    async findByChecksumAndPurpose(checksumSha256, purpose: BlobPurpose) {
      const row = await db.query.blobReferences.findFirst({
        where: and(
          eq(blobReferences.checksumSha256, checksumSha256),
          eq(blobReferences.purpose, purpose),
        ),
      })
      return row ? mapRow(row) : null
    },

    async listByUserId(userId) {
      const rows = await db.query.blobReferences.findMany({
        where: eq(blobReferences.userId, userId),
      })
      return rows.map(mapRow)
    },

    async insert(record) {
      const [row] = await db
        .insert(blobReferences)
        .values({
          id: record.id,
          userId: record.userId,
          projectId: record.projectId,
          storageKey: record.storageKey,
          contentType: record.contentType,
          byteSize: record.byteSize,
          checksumSha256: record.checksumSha256,
          purpose: record.purpose,
          createdAt: record.createdAt,
        })
        .returning()
      return mapRow(row)
    },

    async deleteById(id) {
      await db.delete(blobReferences).where(eq(blobReferences.id, id))
    },

    async deleteByUserId(userId) {
      const deleted = await db
        .delete(blobReferences)
        .where(eq(blobReferences.userId, userId))
        .returning({ id: blobReferences.id })
      return deleted.length
    },
  }
}
