import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../config/db.js'
import { hashPassword, verifyPassword, signToken } from '../../services/auth/crypto.js'
import { asyncHandler } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth-jwt.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().max(120).optional(),
})

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const token = signToken({ sub: user.id, email: user.email })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, createdAt: true },
    })
    if (!user) return res.status(404).json({ error: 'Not found' })
    res.json(user)
  }),
)

// Bootstrap: create the first admin user. Only works if no users exist yet.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const count = await prisma.user.count()
    if (count > 0) {
      return res.status(403).json({ error: 'Registration disabled. Ask an admin to create your account.' })
    }
    const { email, password, name } = registerSchema.parse(req.body)
    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
      select: { id: true, email: true, name: true },
    })
    const token = signToken({ sub: user.id, email: user.email })
    res.status(201).json({ token, user })
  }),
)

export default router
