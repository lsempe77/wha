import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { WhatsAppError, RateLimitError } from '../src/services/whatsapp/errors.js'

describe('WhatsAppError', () => {
  test('marks 429 retryable', () => {
    const e = new WhatsAppError('x', { status: 429 })
    assert.equal(e.retryable, true)
  })
  test('marks 5xx retryable', () => {
    const e = new WhatsAppError('x', { status: 503 })
    assert.equal(e.retryable, true)
  })
  test('marks 4xx non-retryable', () => {
    const e = new WhatsAppError('x', { status: 400 })
    assert.equal(e.retryable, false)
  })
})

describe('RateLimitError', () => {
  test('is retryable and carries retryAfter', () => {
    const e = new RateLimitError('limited', 60)
    assert.equal(e.retryable, true)
    assert.equal(e.retryAfter, 60)
    assert.ok(e instanceof WhatsAppError)
  })
})
