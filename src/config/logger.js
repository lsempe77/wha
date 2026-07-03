import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      }
    : undefined,
  base: { service: 'wa-broadcaster' },
  redact: {
    paths: [
      'whatsapp.accessToken',
      '*.accessToken',
      '*.whatsapp.accessToken',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
})

export default logger
