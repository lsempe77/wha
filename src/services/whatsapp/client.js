import { config } from '../../config/env.js'
import { WhatsAppError, RateLimitError } from './errors.js'

const BASE = `https://graph.facebook.com/${config.whatsapp.apiVersion}`

function buildPayload(to, { templateName, language, components }) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  }
}

async function callApi(path, body) {
  const url = `${BASE}${path}`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new WhatsAppError(`Network error: ${err.message}`, { status: 0 })
  }

  let payload = null
  const text = await res.text()
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text }
  }

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') ?? '30', 10)
    throw new RateLimitError('Rate limited by WhatsApp', retryAfter)
  }

  if (!res.ok) {
    const err = payload?.error
    throw new WhatsAppError(err?.message ?? `HTTP ${res.status}`, {
      status: res.status,
      code: err?.code,
      fbTraceId: err?.fbtrace_id,
    })
  }

  return payload
}

export async function sendTemplate(to, template) {
  const body = buildPayload(to, template)
  const payload = await callApi(
    `/${config.whatsapp.phoneNumberId}/messages`,
    body,
  )
  return {
    messageId: payload?.messages?.[0]?.id ?? null,
    status: payload?.messages?.[0]?.message_status ?? 'sent',
    raw: payload,
  }
}

export async function getMessageStatus(messageId) {
  const url = `${BASE}/${config.whatsapp.phoneNumberId}/messages?message_id=${encodeURIComponent(messageId)}`
  let res
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` },
    })
  } catch (err) {
    throw new WhatsAppError(`Network error: ${err.message}`, { status: 0 })
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new WhatsAppError(payload?.error?.message ?? `HTTP ${res.status}`, {
      status: res.status,
      code: payload?.error?.code,
    })
  }
  return res.json()
}
