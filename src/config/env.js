import 'dotenv/config'

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_API_VERSION',
]

function load() {
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }
  return {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    databaseUrl: process.env.DATABASE_URL,
    databaseProvider: process.env.DATABASE_PROVIDER ?? 'sqlite',
    redisUrl: process.env.REDIS_URL,
    whatsapp: {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      businessPhone: process.env.WHATSAPP_BUSINESS_PHONE,
      apiVersion: process.env.WHATSAPP_API_VERSION,
      rateLimitPerMin: parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_MIN ?? '250', 10),
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: process.env.WHATSAPP_APP_SECRET,
    },
    apiKey: process.env.API_KEY,
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    jwt: {
      secret: process.env.JWT_SECRET ?? 'dev_secret_change_me',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    },
    admin: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  }
}

export const config = load()
