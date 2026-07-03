import { config } from '../../config/env.js'

export function apiKeyAuth(req, res, next) {
  if (!config.apiKey) return next() // disabled in dev if not set
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const queryKey = req.query.api_key
  if (token === config.apiKey || queryKey === config.apiKey) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
