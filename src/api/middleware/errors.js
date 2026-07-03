import { ZodError } from 'zod'
import { WhatsAppError } from '../../services/whatsapp/errors.js'
import logger from '../../config/logger.js'

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.path })
}

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  if (err instanceof WhatsAppError) {
    logger.warn({ err: err.message, code: err.code, status: err.status }, 'whatsapp api error')
    return res.status(err.status && err.status < 500 ? err.status : 502).json({
      error: err.message,
      code: err.code,
    })
  }
  logger.error({ err: err.message, stack: err.stack }, 'unhandled error')
  if (res.headersSent) return next(err)
  res.status(500).json({ error: 'Internal server error' })
}
