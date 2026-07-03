import { z } from 'zod'

export const componentSchema = z.array(
  z.object({
    type: z.enum(['header', 'body', 'button']),
    parameters: z
      .array(
        z.object({
          type: z.enum(['text', 'currency', 'date_time', 'image', 'document', 'video']),
          text: z.string().optional(),
          // for media: { id } ; for currency: { ... } ; kept generic
        }).passthrough(),
      )
      .optional(),
  }).passthrough(),
)

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  templateName: z.string().min(1).max(250),
  templateLanguage: z.string().min(2).max(5).default('es'),
  components: componentSchema.default([]),
  scheduledAt: z
    .string()
    .transform((v) => new Date(v))
    .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid date' }),
  contactIds: z.array(z.string().min(1)).min(1).max(10000).optional(),
  // alternative: pass phone numbers directly
  phones: z.array(z.string().min(1)).max(10000).optional(),
})

export const createContactSchema = z.object({
  phone: z
    .string()
    .min(6)
    .max(20)
    .regex(/^\d+$/, 'Phone must be digits only, no +, no spaces'),
  name: z.string().max(120).optional(),
  tags: z.string().max(500).optional(),
})

export const bulkContactsSchema = z.object({
  contacts: z.array(createContactSchema).min(1).max(50000),
})

export const cancelCampaignSchema = z.object({
  id: z.string().min(1),
})

export function normalizePhone(phone) {
  // strip non-digits, keep leading digits; WhatsApp expects country code without +
  const cleaned = String(phone).replace(/[^\d]/g, '')
  if (cleaned.length < 6) throw new Error('Invalid phone number')
  return cleaned
}
