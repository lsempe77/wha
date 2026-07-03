export class WhatsAppError extends Error {
  constructor(message, { status, code, fbTraceId } = {}) {
    super(message)
    this.name = 'WhatsAppError'
    this.status = status
    this.code = code
    this.fbTraceId = fbTraceId
    this.retryable = status === 429 || (status >= 500 && status < 600)
  }
}

export class RateLimitError extends WhatsAppError {
  constructor(message, retryAfter) {
    super(message, { status: 429, code: 'RATE_LIMIT' })
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
    this.retryable = true
  }
}
