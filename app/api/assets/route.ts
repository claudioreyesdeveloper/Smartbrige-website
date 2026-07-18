import { NextResponse } from "next/server"
import { requireSessionUserId } from "@/lib/auth"
import { isServiceKey, type ServiceKey } from "@/lib/services/catalog"
import { getStorageService } from "@/lib/storage/runtime"
import type { BlobPurpose } from "@/lib/storage"
import { StorageError } from "@/lib/storage/errors"
import { storageErrorResponse, toUploadBody } from "@/lib/storage/http"

export const runtime = "nodejs"

const PURPOSES = new Set<BlobPurpose>(["render", "upload", "factory"])

function parsePurpose(value: FormDataEntryValue | null): BlobPurpose {
  if (typeof value !== "string" || !PURPOSES.has(value as BlobPurpose)) {
    throw new StorageError("validation", "purpose must be render, upload, or factory.")
  }
  return value as BlobPurpose
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId()
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      throw new StorageError("validation", "file is required.")
    }

    const purpose = parsePurpose(form.get("purpose"))
    const checksumSha256 = form.get("checksumSha256")
    if (typeof checksumSha256 !== "string") {
      throw new StorageError("validation", "checksumSha256 is required.")
    }

    const projectIdValue = form.get("projectId")
    const projectId =
      typeof projectIdValue === "string" && projectIdValue.length > 0 ? projectIdValue : null

    const serviceKeyValue = form.get("serviceKey")
    let serviceKey: ServiceKey | undefined
    if (typeof serviceKeyValue === "string" && serviceKeyValue.length > 0) {
      if (!isServiceKey(serviceKeyValue)) {
        throw new StorageError("validation", "serviceKey is invalid.")
      }
      serviceKey = serviceKeyValue
    }

    const body = toUploadBody(await file.arrayBuffer())
    const result = await getStorageService().uploadAsset({
      userId,
      purpose,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      body,
      checksumSha256,
      projectId,
      serviceKey,
    })

    return NextResponse.json({
      id: result.reference.id,
      storageKey: result.reference.storageKey,
      contentType: result.reference.contentType,
      byteSize: result.reference.byteSize,
      checksumSha256: result.reference.checksumSha256,
      purpose: result.reference.purpose,
      projectId: result.reference.projectId,
      deduplicated: result.deduplicated,
    })
  } catch (error) {
    return storageErrorResponse(error)
  }
}
