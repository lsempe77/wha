import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { verifyWebhookSignature, verifyWebhookToken } from '../src/services/whatsapp/webhook.js'

describe('verifyWebhookToken', () => {
  const orig = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  before(() => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'secret_token'
  })
  after(() => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = orig
  })

  test('accepts correct token', () => {
    assert.equal(verifyWebhookToken('subscribe', 'secret_token'), true)
  })
  test('rejects wrong token', () => {
    assert.equal(verifyWebhookToken('subscribe', 'wrong'), false)
  })
  test('rejects wrong mode', () => {
    assert.equal(verifyWebhookToken('unsubscribe', 'secret_token'), false)
  })
})

describe('verifyWebhookSignature', () => {
  const orig = process.env.WHATSAPP_APP_SECRET
  after(() => {
    process.env.WHATSAPP_APP_SECRET = orig
  })

  test('accepts valid signature', () => {
    process.env.WHATSAPP_APP_SECRET = 'mysecret'
    const body = '{"entry":[]}'
    const sig = 'sha256=' + crypto.createHmac('sha256', 'mysecret').update(body).digest('hex')
    assert.equal(verifyWebhookSignature(body, sig), true)
  })

  test('rejects tampered signature', () => {
    process.env.WHATSAPP_APP_SECRET = 'mysecret'
    assert.equal(verifyWebhookSignature('{"a":1}', 'sha256=deadbeef'), false)
  })

  test('skips verification when no app secret (dev)', () => {
    delete process.env.WHATSAPP_APP_SECRET
    assert.equal(verifyWebhookSignature('anything', 'sha256=x'), true)
  })
})
