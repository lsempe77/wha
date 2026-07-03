import crypto from 'node:crypto'

const appSecret = () => process.env.WHATSAPP_APP_SECRET
const verifyToken = () => process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

// Meta sends x-hub-signature-256 = "sha256=<hex>"
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = appSecret()
  if (!secret) {
    // skip verification if app secret not configured (dev)
    return true
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const expected = signatureHeader.slice(7)
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(digest))
  } catch {
    return false
  }
}

export function verifyWebhookToken(mode, token) {
  const expected = verifyToken()
  if (!expected) return false
  return mode === 'subscribe' && token === expected
}
