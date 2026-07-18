export type BillingErrorCode =
  | "unauthenticated"
  | "unavailable_service"
  | "unknown_price"
  | "invalid_request"
  | "configuration"
  | "stripe"

export class BillingError extends Error {
  readonly code: BillingErrorCode

  constructor(code: BillingErrorCode, message: string) {
    super(message)
    this.name = "BillingError"
    this.code = code
  }
}

export function billingErrorHttpStatus(error: BillingError): number {
  switch (error.code) {
    case "unauthenticated":
      return 401
    case "unavailable_service":
    case "unknown_price":
    case "invalid_request":
      return 400
    case "configuration":
      return 500
    case "stripe":
      return 502
    default:
      return 500
  }
}
