import { Worker, Queue } from 'bullmq'
import { connection } from '../config/redis.js'
import logger from '../config/logger.js'
import prisma from '../config/db.js'
import { config } from '../config/env.js'
import { MESSAGE_QUEUE } from './queues.js'
import { RecipientStatus, CampaignStatus } from '../constants/status.js'
import { sendTemplate } from '../services/whatsapp/client.js'
import { WhatsAppError } from '../services/whatsapp/errors.js'

// Rate limiter: max N jobs per minute globally per phone number id.
// Implemented via a separate limiter queue feeding the message worker.
const RATE_LIMITER_NAME = 'message-limiter'
const rateLimiterQueue = new Queue(RATE_LIMITER_NAME, {
  connection,
  limiter: {
    max: config.whatsapp.rateLimitPerMin,
    duration: 60_000,
  },
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 10000 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
})

async function sendMessage(job) {
  const { campaignRecipientId, to, template } = job.data
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: campaignRecipientId },
    include: { campaign: true },
  })
  if (!recipient) {
    logger.warn({ campaignRecipientId }, 'recipient not found, skipping')
    return
  }
  if (
    recipient.campaign.status === CampaignStatus.CANCELLED ||
    recipient.status === RecipientStatus.SENT
  ) {
    logger.info({ campaignRecipientId }, 'skipping (cancelled or already sent)')
    return
  }

  await prisma.campaignRecipient.update({
    where: { id: campaignRecipientId },
    data: { attempts: { increment: 1 } },
  })

  try {
    const result = await sendTemplate(to, template)
    await prisma.campaignRecipient.update({
      where: { id: campaignRecipientId },
      data: {
        status: RecipientStatus.SENT,
        waMessageId: result.messageId,
        waStatus: result.status,
        sentAt: new Date(),
      },
    })
    logger.info({ campaignRecipientId, to, waMessageId: result.messageId }, 'message sent')
  } catch (err) {
    const isWapp = err instanceof WhatsAppError
    const fatal = isWapp && !err.retryable

    await prisma.campaignRecipient.update({
      where: { id: campaignRecipientId },
      data: {
        status: fatal ? RecipientStatus.FAILED : recipient.status,
        waStatus: err.code ?? String(err.status),
        errorMessage: err.message,
        failedAt: fatal ? new Date() : null,
      },
    })

    if (fatal) {
      logger.error({ campaignRecipientId, to, err: err.message, code: err.code }, 'message failed permanently')
      return
    }
    // retryable: re-throw so BullMQ backs off
    logger.warn({ campaignRecipientId, to, err: err.message, retryable: true }, 'message will retry')
    throw err
  }
}

export function startMessageWorker() {
  // The rate-limiter queue dispatches into a worker that performs the actual send.
  const worker = new Worker(RATE_LIMITER_NAME, sendMessage, {
    connection,
    concurrency: 10,
  })

  worker.on('completed', (j) => logger.debug({ job: j.id }, 'message job completed'))
  worker.on('failed', (j, err) =>
    logger.error({ job: j?.id, err: err.message }, 'message job failed (will retry if attempts left)'),
  )

  // Bridge: pull from MESSAGE_QUEUE (added by campaign worker) and add to rate-limiter
  const bridgeWorker = new Worker(
    MESSAGE_QUEUE,
    async (job) => {
      await rateLimiterQueue.add('send', job.data, { jobId: `msg:${job.data.campaignRecipientId}` })
    },
    { connection, concurrency: 50 },
  )
  bridgeWorker.on('failed', (j, err) =>
    logger.error({ job: j?.id, err: err.message }, 'bridge worker failed'),
  )

  return { worker, bridgeWorker, rateLimiterQueue }
}

export async function enqueueMessage(data) {
  return rateLimiterQueue.add('send', data, {
    jobId: `msg:${data.campaignRecipientId}`,
  })
}

export { rateLimiterQueue }
