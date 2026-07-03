import { Router } from 'express'
import prisma from '../../config/db.js'
import { asyncHandler } from '../middleware/auth.js'
import { createContactSchema, bulkContactsSchema, normalizePhone } from '../../services/whatsapp/validation.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, tag, limit = '100', offset = '0' } = req.query
    const where = {}
    if (q) where.OR = [{ phone: { contains: q } }, { name: { contains: q } }]
    if (tag) where.tags = { contains: tag }
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit, 10), 500),
        skip: parseInt(offset, 10),
      }),
      prisma.contact.count({ where }),
    ])
    res.json({ data: contacts, total, offset: parseInt(offset, 10), limit: parseInt(limit, 10) })
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createContactSchema.parse(req.body)
    const contact = await prisma.contact.create({
      data: { ...parsed, phone: normalizePhone(parsed.phone) },
    })
    res.status(201).json(contact)
  }),
)

router.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const parsed = bulkContactsSchema.parse(req.body)
    // normalize phones before insert
    const data = parsed.contacts.map((c) => ({ ...c, phone: normalizePhone(c.phone) }))
    const result = await prisma.contact.createMany({
      data,
      skipDuplicates: true,
    })
    res.status(201).json({ created: result.count })
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.contact.delete({ where: { id: req.params.id } })
    res.status(204).end()
  }),
)

export default router
