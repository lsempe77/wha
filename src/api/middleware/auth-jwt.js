import { verifyToken } from '../../services/auth/crypto.js'
import prisma from '../../config/db.js'

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' })
  req.user = { id: payload.sub, email: payload.email }
  next()
}

// Optional auth: attaches user if token present, otherwise continues
export function optionalAuth(req, res, next) {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (token) {
    const payload = verifyToken(token)
    if (payload) req.user = { id: payload.sub, email: payload.email }
  }
  next()
}

export async function requireAdmin(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true } })
  if (!user) return res.status(401).json({ error: 'User not found' })
  next()
}
