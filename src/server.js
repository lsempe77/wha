import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from './config/env.js'
import logger from './config/logger.js'
import { seedAdmin } from './config/seedAdmin.js'
import apiRouter from './api/router.js'
import { notFound, errorHandler } from './api/middleware/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// Capture raw body BEFORE json parsing for webhook signature verification
app.use((req, res, next) => {
  let raw = ''
  req.on('data', (chunk) => {
    raw += chunk.toString()
  })
  req.on('end', () => {
    req.rawBody = raw
    if (!raw) return next()
    try {
      req.body = JSON.parse(raw)
    } catch {
      req.body = raw
    }
    next()
  })
})

app.disable('x-powered-by')
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  }),
)
app.use(compression())
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))
app.use(
  morgan('tiny', {
    stream: { write: (msg) => logger.info({ type: 'http' }, msg.trim()) },
  }),
)

// API
app.use('/api', apiRouter)

// Dashboard: serve React build (dist/) in production, vanilla fallback (public/) in dev
const frontendDir =
  config.env === 'production'
    ? path.join(__dirname, '..', 'dist')
    : path.join(__dirname, '..', 'public')
app.use(express.static(frontendDir))

// SPA fallback: serve index.html for non-API, non-asset routes
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next()
  const indexFile = path.join(frontendDir, 'index.html')
  res.sendFile(indexFile, (err) => {
    if (err) next()
  })
})

app.use(notFound)
app.use(errorHandler)

const server = app.listen(config.port, async () => {
  logger.info(`server listening on :${config.port} (env=${config.env})`)
  try {
    await seedAdmin()
  } catch (err) {
    logger.error({ err: err.message }, 'failed to seed admin')
  }
})

function shutdown(signal) {
  logger.info({ signal }, 'shutting down')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default app
