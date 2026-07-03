import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhone, createCampaignSchema, createContactSchema } from '../src/services/whatsapp/validation.js'

describe('normalizePhone', () => {
  test('strips non-digits', () => {
    assert.equal(normalizePhone('+34 600 000 000'), '34600000000')
    assert.equal(normalizePhone('  (600) 000-000 '), '600000000')
  })
  test('rejects too short', () => {
    assert.throws(() => normalizePhone('123'), /Invalid phone/)
  })
})

describe('createContactSchema', () => {
  test('accepts valid contact', () => {
    const out = createContactSchema.parse({ phone: '34600000000', name: 'Test' })
    assert.equal(out.phone, '34600000000')
    assert.equal(out.name, 'Test')
  })
  test('rejects phone with + or spaces', () => {
    assert.throws(() => createContactSchema.parse({ phone: '+34 600' }))
  })
})

describe('createCampaignSchema', () => {
  test('accepts campaign with phones', () => {
    const out = createCampaignSchema.parse({
      name: 'Test',
      templateName: 'hello_world',
      scheduledAt: '2026-12-31T10:00:00Z',
      phones: ['34600000000', '34611111111'],
      components: [],
    })
    assert.equal(out.phones.length, 2)
    assert.deepEqual(out.components, [])
  })
  test('defaults templateLanguage to es', () => {
    const out = createCampaignSchema.parse({
      name: 'T',
      templateName: 'x',
      scheduledAt: '2026-12-31T10:00:00Z',
    })
    assert.equal(out.templateLanguage, 'es')
  })
  test('rejects invalid date', () => {
    assert.throws(() =>
      createCampaignSchema.parse({ name: 'T', templateName: 'x', scheduledAt: 'not-a-date' }),
    )
  })
  test('rejects empty recipients handled at route level (schema allows omitting both)', () => {
    const out = createCampaignSchema.parse({
      name: 'T',
      templateName: 'x',
      scheduledAt: '2026-12-31T10:00:00Z',
    })
    assert.ok(!out.contactIds && !out.phones)
  })
})
