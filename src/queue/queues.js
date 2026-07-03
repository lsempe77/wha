import { Queue } from 'bullmq'
import { connection } from '../config/redis.js'
import logger from '../config/logger.js'

export const CAMPAIGN_QUEUE = 'campaign-process'
export const MESSAGE_QUEUE = 'message-send'

export const campaignQueue = new Queue(CAMPAIGN_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
})

export const messageQueue = new Queue(MESSAGE_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 24 * 3600, count: 10000 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
})

export async function scheduleCampaign(campaignId, scheduledAt) {
  const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now())
  const job = await campaignQueue.add(
    'process',
    { campaignId },
    { delay, jobId: `campaign:${campaignId}` },
  )
  logger.info({ campaignId, jobId: job.id, delay }, 'campaign scheduled')
  return job
}

export async function cancelCampaign(campaignId) {
  const job = await campaignQueue.getJob(`campaign:${campaignId}`)
  if (job && (await job.isActive()) === false) {
    await job.remove()
    return true
  }
  return false
}

export async function getQueueStats() {
  const [campaign, message] = await Promise.all([
    campaignQueue.getJobCounts(),
    messageQueue.getJobCounts(),
  ])
  return { campaign, message }
}
