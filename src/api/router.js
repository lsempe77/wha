import { Router } from 'express'
import { config } from '../config/env.js'
import { apiKeyAuth } from './middleware/auth.js'
import { requireAuth } from './middleware/auth-jwt.js'
import campaigns from './routes/campaigns.js'
import contacts from './routes/contacts.js'
import webhook from './routes/webhook.js'
import status from './routes/status.js'
import auth from './routes/auth.js'

const router = Router()

// Webhook is public (Meta calls it), but signature-verified internally
router.use('/webhook', webhook)
// Health is public
router.use('/status', status)
// Auth endpoints
router.use('/auth', auth)

// Management endpoints: require JWT if no API_KEY set, otherwise either auth works.
function managementAuth(req, res, next) {
  if (config.apiKey) {
    return apiKeyAuth(req, res, next)
  }
  return requireAuth(req, res, next)
}

router.use('/campaigns', managementAuth, campaigns)
router.use('/contacts', managementAuth, contacts)

export default router
