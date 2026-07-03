import IORedis from 'ioredis'
import { config } from './env.js'

export const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

connection.on('error', (err) => {
  console.error('[redis]', err.message)
})

export default connection
