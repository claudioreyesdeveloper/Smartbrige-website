import { createHash } from "node:crypto"

export function hashWebhookPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex")
}
