import prisma from '../config/db.js'
import { config } from '../config/env.js'
import { hashPassword } from '../services/auth/crypto.js'
import logger from './logger.js'

export async function seedAdmin() {
  if (!config.admin.email || !config.admin.password) return
  const exists = await prisma.user.findUnique({ where: { email: config.admin.email } })
  if (exists) return
  await prisma.user.create({
    data: {
      email: config.admin.email,
      passwordHash: await hashPassword(config.admin.password),
      name: 'Admin',
    },
  })
  logger.info({ email: config.admin.email }, 'seeded admin user')
}
