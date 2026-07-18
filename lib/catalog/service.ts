import { assertAuthenticatedUserId, AuthorizationError } from "@/lib/auth/owner"
import { CatalogError } from "@/lib/catalog/errors"
import { activateCatalogVersion } from "@/lib/catalog/import"
import { assertCatalogServiceAvailable } from "@/lib/catalog/mapping"
import type { CatalogStore } from "@/lib/catalog/store"
import type {
  CatalogActivationRecord,
  CatalogEntryPublic,
  CatalogListResult,
  CatalogVersionRecord,
} from "@/lib/catalog/types"
import type { ServiceKey } from "@/lib/services/catalog"
import type { AuthorizedDownload } from "@/lib/storage/types"

export type CatalogEntitlementChecker = {
  userHasEntitlement: (userId: string, serviceKey: ServiceKey) => Promise<boolean>
}

export type CatalogDownloadAuthorizer = {
  authorizeDownload: (
    actorUserId: string,
    blobReferenceId: string,
  ) => Promise<AuthorizedDownload>
}

export type CatalogServiceDeps = {
  store: CatalogStore
  entitlements: CatalogEntitlementChecker
  downloads: CatalogDownloadAuthorizer
  now?: () => Date
}

function requireUserId(userId: string | undefined | null): string {
  try {
    assertAuthenticatedUserId(userId)
    return userId
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new CatalogError(error.code, error.message)
    }
    throw error
  }
}

function toPublicEntry(entry: {
  stableId: string
  section: string
  kind: string
  metadata: Record<string, unknown>
  blobReferenceId: string | null
}): CatalogEntryPublic {
  return {
    stableId: entry.stableId,
    section: entry.section,
    kind: entry.kind,
    metadata: entry.metadata,
    hasAsset: Boolean(entry.blobReferenceId),
    blobReferenceId: entry.blobReferenceId,
  }
}

export class CatalogService {
  private readonly now: () => Date

  constructor(private readonly deps: CatalogServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  async listForService(
    userId: string | undefined | null,
    serviceKeyRaw: string,
  ): Promise<CatalogListResult> {
    const actorId = requireUserId(userId)
    const serviceKey = assertCatalogServiceAvailable(serviceKeyRaw)
    await this.requireEntitlement(actorId, serviceKey)

    const activation = await this.deps.store.getActivation(serviceKey)
    if (!activation) {
      throw new CatalogError("not_found", `No active catalog version for service: ${serviceKey}`)
    }

    const version = await this.deps.store.findVersionById(activation.catalogVersionId)
    if (!version || version.status !== "ready") {
      throw new CatalogError("unavailable", "Active catalog version is not ready.")
    }

    const entries = await this.deps.store.listEntriesForService(version.id, serviceKey)
    return {
      serviceKey,
      catalogVersionId: version.id,
      contentTreeSha256: version.contentTreeSha256,
      catalogExportVersion: version.catalogExportVersion,
      schemaVersion: version.schemaVersion,
      entries: entries.map(toPublicEntry),
    }
  }

  async getEntry(
    userId: string | undefined | null,
    serviceKeyRaw: string,
    stableId: string,
  ): Promise<CatalogEntryPublic> {
    const list = await this.listForService(userId, serviceKeyRaw)
    const entry = list.entries.find((item) => item.stableId === stableId)
    if (!entry) {
      throw new CatalogError("not_found", `Catalog entry was not found: ${stableId}`)
    }
    return entry
  }

  async authorizeAssetAccess(
    userId: string | undefined | null,
    serviceKeyRaw: string,
    stableId: string,
  ): Promise<AuthorizedDownload> {
    const actorId = requireUserId(userId)
    const serviceKey = assertCatalogServiceAvailable(serviceKeyRaw)
    await this.requireEntitlement(actorId, serviceKey)

    const activation = await this.deps.store.getActivation(serviceKey)
    if (!activation) {
      throw new CatalogError("not_found", `No active catalog version for service: ${serviceKey}`)
    }

    const entry = await this.deps.store.findEntry(activation.catalogVersionId, stableId)
    if (!entry || entry.serviceKey !== serviceKey) {
      throw new CatalogError("not_found", `Catalog entry was not found: ${stableId}`)
    }
    if (!entry.blobReferenceId) {
      throw new CatalogError("not_found", `Catalog entry has no asset: ${stableId}`)
    }

    try {
      return await this.deps.downloads.authorizeDownload(actorId, entry.blobReferenceId)
    } catch (error) {
      if (error instanceof CatalogError) {
        throw error
      }
      const code =
        typeof error === "object" &&
        error &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : "unavailable"
      const message = error instanceof Error ? error.message : "Asset authorization failed."
      if (
        code === "forbidden" ||
        code === "unauthenticated" ||
        code === "not_found" ||
        code === "expired"
      ) {
        throw new CatalogError(
          code === "expired" ? "forbidden" : (code as "forbidden" | "unauthenticated" | "not_found"),
          message,
        )
      }
      throw new CatalogError("unavailable", message)
    }
  }

  async listVersions(): Promise<CatalogVersionRecord[]> {
    return this.deps.store.listVersions()
  }

  async listActivations(): Promise<CatalogActivationRecord[]> {
    return this.deps.store.listActivations()
  }

  async activate(
    serviceKeyRaw: string,
    catalogVersionId: string,
  ): Promise<{ serviceKey: ServiceKey; catalogVersionId: string }> {
    const serviceKey = assertCatalogServiceAvailable(serviceKeyRaw)
    await activateCatalogVersion(this.deps.store, serviceKey, catalogVersionId, this.now)
    return { serviceKey, catalogVersionId }
  }

  async rollback(serviceKeyRaw: string): Promise<{
    serviceKey: ServiceKey
    catalogVersionId: string
    previousCatalogVersionId: string | null
  }> {
    const serviceKey = assertCatalogServiceAvailable(serviceKeyRaw)
    const activation = await this.deps.store.getActivation(serviceKey)
    if (!activation?.previousCatalogVersionId) {
      throw new CatalogError(
        "conflict",
        `No previous catalog version available to roll back for ${serviceKey}.`,
      )
    }
    const targetId = activation.previousCatalogVersionId
    await activateCatalogVersion(this.deps.store, serviceKey, targetId, this.now)
    return {
      serviceKey,
      catalogVersionId: targetId,
      previousCatalogVersionId: activation.catalogVersionId,
    }
  }

  private async requireEntitlement(userId: string, serviceKey: ServiceKey): Promise<void> {
    const allowed = await this.deps.entitlements.userHasEntitlement(userId, serviceKey)
    if (!allowed) {
      throw new CatalogError("forbidden", `Service entitlement required: ${serviceKey}`)
    }
  }
}
