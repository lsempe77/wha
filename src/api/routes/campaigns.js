import { Router } from 'express'
import prisma from '../../config/db.js'
import { asyncHandler } from '../middleware/auth.js'
import { createCampaignSchema, normalizePhone } from '../../services/whatsapp/validation.js'
import { scheduleCampaign, cancelCampaign } from '../../queue/queues.js'
import { CampaignStatus, RecipientStatus } from '../../constants/status.js'

const router = Router()

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createCampaignSchema.parse(req.body)
    const componentsJson = JSON.stringify(parsed.components)

    let contactIds = parsed.contactIds ?? []

    // If phones provided, upsert contacts and use their ids
    if (parsed.phones?.length) {
      const upserts = parsed.phones.map((p) =>
        prisma.contact.upsert({
          where: { phone: normalizePhone(p) },
          update: {},
          create: { phone: normalizePhone(p) },
          select: { id: true },
        }),
      )
      const contacts = await Promise.all(upserts)
      contactIds = [...contactIds, ...contacts.map((c) => c.id)]
    }

    // Dedupe
    contactIds = [...new Set(contactIds)]
    if (!contactIds.length) return res.status(400).json({ error: 'No recipients provided' })

    const campaign = await prisma.campaign.create({
      data: {
        name: parsed.name,
        templateName: parsed.templateName,
        templateLanguage: parsed.templateLanguage,
        components: componentsJson,
        scheduledAt: parsed.scheduledAt,
        status: CampaignStatus.SCHEDULED,
        recipients: { create: contactIds.map((id) => ({ contactId: id })) },
      },
      include: { _count: { select: { recipients: true } } },
    })

    await scheduleCampaign(campaign.id, parsed.scheduledAt)
    res.status(201).json(campaign)
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { recipients: true } },
        recipients: {
          where: { status: RecipientStatus.FAILED },
          select: { id: true },
          take: 1,
        },
      },
    })
    res.json(
      campaigns.map((c) => ({
        ...c,
        recipientCount: c._count.recipients,
        failedCount: c.recipients.length,
        _count: undefined,
        recipients: undefined,
      })),
    )
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        recipients: {
          include: { contact: { select: { phone: true, name: true } } },
          orderBy: { createdAt: 'asc' },
          take: 500,
        },
      },
    })
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    res.json(campaign)
  }),
)

router.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const groups = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: req.params.id },
      _count: { _all: true },
    })
    res.json({ statuses: groups })
  }),
)

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const cancelled = await cancelCampaign(req.params.id)
    if (cancelled) {
      await prisma.campaign.update({
        where: { id: req.params.id },
        data: { status: CampaignStatus.CANCELLED },
      })
    }
    res.json({ cancelled })
  }),
)

export default router
