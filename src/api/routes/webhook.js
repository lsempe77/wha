import { Router } from 'express'
import prisma from '../../config/db.js'
import logger from '../../config/logger.js'
import { asyncHandler } from '../middleware/auth.js'
import { verifyWebhookToken, verifyWebhookSignature } from '../../services/whatsapp/webhook.js'
import { RecipientStatus } from '../../constants/status.js'

const router = Router()

// GET: Meta webhook verification
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (!verifyWebhookToken(mode, token)) {
      logger.warn({ mode }, 'webhook verification failed')
      return res.sendStatus(403)
    }
    logger.info('webhook verified')
    return res.status(200).send(challenge)
  }),
)

// POST: status callbacks. Requires raw body for signature verification (set in server.js)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-hub-signature-256']
    if (!verifyWebhookSignature(req.rawBody ?? '', signature)) {
      logger.warn('webhook signature invalid')
      return res.sendStatus(401)
    }

    const body = req.body
    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    // Only handle message status updates for now
    const statuses = value?.statuses
    if (Array.isArray(statuses)) {
      for (const s of statuses) {
        await updateRecipientStatus(s)
      }
    }
    // Always 200 ACK quickly
    res.sendStatus(200)
  }),
)

async function updateRecipientStatus(s) {
  const messageId = s.id
  if (!messageId) return
  const status = String(s.status).toUpperCase()
  const map = {
    SENT: RecipientStatus.SENT,
    DELIVERED: RecipientStatus.DELIVERED,
    READ: RecipientStatus.READ,
    FAILED: RecipientStatus.FAILED,
  }
  const newStatus = map[status] ?? null
  if (!newStatus) return

  const data = {
    status: newStatus,
    waStatus: status,
    ...(newStatus === RecipientStatus.DELIVERED && { deliveredAt: new Date() }),
    ...(newStatus === RecipientStatus.READ && { readAt: new Date() }),
    ...(newStatus === RecipientStatus.FAILED && {
      failedAt: new Date(),
      errorMessage: s.errors?.map((e) => e.message).join('; '),
    }),
  }

  const updated = await prisma.campaignRecipient.updateMany({
    where: { waMessageId: messageId },
    data,
  })
  if (updated.count) {
    logger.debug({ messageId, status: newStatus }, 'recipient status updated')
  }
}

export default router
