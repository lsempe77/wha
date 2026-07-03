import 'dotenv/config'
import { startCampaignWorker } from './queue/campaignWorker.js'
import { startMessageWorker } from './queue/messageWorker.js'
import logger from './config/logger.js'

logger.info('starting worker process')

const campaignWorker = startCampaignWorker()
const { worker: messageWorker, bridgeWorker } = startMessageWorker()

async function shutdown(signal) {
  logger.info({ signal }, 'worker shutting down')
  await Promise.allSettled([
    campaignWorker.close(),
    messageWorker.close(),
    bridgeWorker.close(),
  ])
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
