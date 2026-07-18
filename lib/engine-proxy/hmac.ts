import { createHash, createHmac, randomBytes } from "node:crypto"
import {
  MAX_REQUEST_ID_LENGTH,
  MIN_REQUEST_ID_LENGTH,
} from "@/lib/jam/domain/limits"

/**
 * Service-to-service HMAC headers — must match private algorithm-service verify.
 * Public proxy signs with PRIVATE_ENGINE_SIGNING_SECRET; private verifies with
 * ALGORITHM_SERVICE_HMAC_SECRET_CURRENT (same secret value, different env names).
 */
export const HMAC_TIMESTAMP_HEADER = "x-sb-timestamp"
export const HMAC_SIGNATURE_HEADER = "x-sb-signature"
export const HMAC_BODY_HASH_HEADER = "x-sb-content-sha256"
export const HMAC_REQUEST_ID_HEADER = "x-sb-request-id"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/

export function sha256Hex(data: string | Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex")
}

export function buildSigningPayload(
  timestampSeconds: string,
  requestId: string,
  bodyHashHex: string,
): string {
  return `${timestampSeconds}.${requestId}.${bodyHashHex}`
}

export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

/** 192 bits of CSPRNG entropy encoded in the private contract's safe alphabet. */
export function generateEngineRequestId(): string {
  return `req_${randomBytes(24).toString("base64url")}`
}

function assertRequestId(value: string): string {
  if (
    value.length < MIN_REQUEST_ID_LENGTH ||
    value.length > MAX_REQUEST_ID_LENGTH ||
    !REQUEST_ID_PATTERN.test(value)
  ) {
    throw new Error("Generated engine request ID is invalid")
  }
  return value
}

export type SignedRequestHeaders = {
  [HMAC_TIMESTAMP_HEADER]: string
  [HMAC_REQUEST_ID_HEADER]: string
  [HMAC_BODY_HASH_HEADER]: string
  [HMAC_SIGNATURE_HEADER]: string
  "content-type": string
}

export function signEngineRequest(options: {
  rawBody: string
  secret: string
  nowMs?: number
  requestIdFactory?: () => string
}): SignedRequestHeaders {
  const timestampSeconds = String(Math.floor((options.nowMs ?? Date.now()) / 1000))
  const requestId = assertRequestId(
    (options.requestIdFactory ?? generateEngineRequestId)(),
  )
  const bodyHash = sha256Hex(options.rawBody)
  const payload = buildSigningPayload(timestampSeconds, requestId, bodyHash)
  return {
    [HMAC_TIMESTAMP_HEADER]: timestampSeconds,
    [HMAC_REQUEST_ID_HEADER]: requestId,
    [HMAC_BODY_HASH_HEADER]: bodyHash,
    [HMAC_SIGNATURE_HEADER]: signPayload(options.secret, payload),
    "content-type": "application/json",
  }
}
