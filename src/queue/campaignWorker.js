import { Worker } from 'bullmq'
import { prisma } from '../config/db.js'
import { connection } from '../config/redis.js'
import logger from '../config/logger.js'
import { CAMPAIGN_QUEUE, messageQueue } from './queues.js'
import { config } from '../config/env.js'
import { CampaignStatus, RecipientStatus } from '../constants/status.js'

async function processCampaign(job) {
  const { campaignId } = job.data
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { recipients: { where: { status: RecipientStatus.QUEUED } } },
  })
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)
  if (
    campaign.status === CampaignStatus.CANCELLED ||
    campaign.status === CampaignStatus.COMPLETED
  ) {
    logger.info({ campaignId, status: campaign.status }, 'skipping campaign')
    return
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.RUNNING, startedAt: new Date() },
  })

  const components = JSON.parse(campaign.components || '[]')
  const template = {
    templateName: campaign.templateName,
    language: campaign.templateLanguage,
    components,
  }

  // Enqueue per-recipient message jobs with rate-limit group
  const rateGroup = `wa-${config.whatsapp.phoneNumberId}`
  let enqueued = 0
  for (const r of campaign.recipients) {
    const contact = await prisma.contact.findUnique({ where: { id: r.contactId } })
    if (!contact) continue
    await messageQueue.add(
      'send',
      {
        campaignRecipientId: r.id,
        to: contact.phone,
        template,
      },
      {
        // group rate limiting: BullMQ will limit concurrency per group key
        group: { id: rateGroup },
      },
    )
    enqueued++
  }

  logger.info({ campaignId, enqueued }, 'campaign enqueued to message queue')
}

export function startCampaignWorker() {
  const worker = new Worker(CAMPAIGN_QUEUE, processCampaign, {
    connection,
    concurrency: 5,
  })
  worker.on('completed', (j) => logger.info({ job: j.id }, 'campaign job completed'))
  worker.on('failed', (j, err) => logger.error({ job: j?.id, err: err.message }, 'campaign job failed'))
  return worker
}
