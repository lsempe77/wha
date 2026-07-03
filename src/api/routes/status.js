import { Router } from 'express'
import { config } from '../../config/env.js'
import { getQueueStats } from '../../queue/queues.js'
import { connection } from '../../config/redis.js'
import prisma from '../../config/db.js'
import { asyncHandler } from '../middleware/auth.js'

const router = Router()

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const checks = {}
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.db = 'ok'
    } catch {
      checks.db = 'fail'
    }
    try {
      const pong = await Promise.race([
        connection.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ])
      checks.redis = pong === 'PONG' ? 'ok' : 'fail'
    } catch {
      checks.redis = 'fail'
    }
    checks.whatsappConfigured = Boolean(config.whatsapp.phoneNumberId && config.whatsapp.accessToken)
    const ok = Object.values(checks).every((v) => v === 'ok' || v === true)
    res.status(ok ? 200 : 503).json({ status: ok ? 'healthy' : 'degraded', checks })
  }),
)

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const queueStats = await getQueueStats()
    const [campaigns, contacts] = await Promise.all([
      prisma.campaign.count(),
      prisma.contact.count(),
    ])
    res.json({ queues: queueStats, campaigns, contacts })
  }),
)

export default router
