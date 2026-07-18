import { createHash, createHmac } from "node:crypto"

/**
 * Service-to-service HMAC headers — must match private algorithm-service verify.
 * Public proxy signs with PRIVATE_ENGINE_SIGNING_SECRET; private verifies with
 * ALGORITHM_SERVICE_HMAC_SECRET_CURRENT (same secret value, different env names).
 */
export const HMAC_TIMESTAMP_HEADER = "x-sb-timestamp"
export const HMAC_SIGNATURE_HEADER = "x-sb-signature"
export const HMAC_BODY_HASH_HEADER = "x-sb-content-sha256"

export function sha256Hex(data: string | Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex")
}

export function buildSigningPayload(timestampSeconds: string, bodyHashHex: string): string {
  return `${timestampSeconds}.${bodyHashHex}`
}

export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

export type SignedRequestHeaders = {
  [HMAC_TIMESTAMP_HEADER]: string
  [HMAC_BODY_HASH_HEADER]: string
  [HMAC_SIGNATURE_HEADER]: string
  "content-type": string
}

export function signEngineRequest(options: {
  rawBody: string
  secret: string
  nowMs?: number
}): SignedRequestHeaders {
  const timestampSeconds = String(Math.floor((options.nowMs ?? Date.now()) / 1000))
  const bodyHash = sha256Hex(options.rawBody)
  const payload = buildSigningPayload(timestampSeconds, bodyHash)
  return {
    [HMAC_TIMESTAMP_HEADER]: timestampSeconds,
    [HMAC_BODY_HASH_HEADER]: bodyHash,
    [HMAC_SIGNATURE_HEADER]: signPayload(options.secret, payload),
    "content-type": "application/json",
  }
}
