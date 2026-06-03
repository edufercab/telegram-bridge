import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { env } from './lib/env'
import { errorHandler } from './middleware/errorHandler'
import { apiKeyMiddleware } from './middleware/apiKey'
import { bodyLimitMiddleware } from './middleware/bodyLimit'
import { healthRoute } from './routes/health'
import { sessionRoute } from './routes/session'
import { sendRoute } from './routes/send'
import { sendPhotoRoute } from './routes/sendPhoto'
import { inboxRoute } from './routes/inbox'
import { startBot, stopBot, sendMessage } from './services/telegram'
import * as db from './db'

const app = new Hono()

app.onError(errorHandler)

// Minimal security headers — this is a local server but good hygiene for the community
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
})

app.route('/health', healthRoute)

const api = new Hono()
api.use('*', apiKeyMiddleware)
api.use('*', bodyLimitMiddleware)
api.route('/session', sessionRoute)
api.route('/send', sendRoute)
api.route('/send-photo', sendPhotoRoute)
api.route('/inbox', inboxRoute)

app.route('/', api)

// Auto-expire idle sessions and notify the user via Telegram
const EXPIRY_CHECK_INTERVAL_MS = 60_000
setInterval(async () => {
  const session = db.getSession()
  if (session.active === 0 || !session.last_activity) return

  const idleMs = Date.now() - new Date(session.last_activity).getTime()
  const idleMinutes = idleMs / 60_000

  if (idleMinutes >= env.SESSION_TIMEOUT_MINUTES) {
    console.log(`Session expired after ${env.SESSION_TIMEOUT_MINUTES} minutes of inactivity`)
    db.endSession()
    await sendMessage(
      `⏰ Session closed automatically after ${env.SESSION_TIMEOUT_MINUTES} minutes of inactivity.`,
      'plain',
    ).catch(() => {})
  }
}, EXPIRY_CHECK_INTERVAL_MS)

async function main() {
  if (db.getSession().active === 1) {
    db.endSession()
    console.log('Stale session cleared on startup')
  }

  await startBot()

  serve({ fetch: app.fetch, port: env.PORT }, () => {
    console.log(`Telegram Bridge running on http://localhost:${env.PORT}`)
    console.log(`Environment: ${env.NODE_ENV}`)
  })
}

function shutdown() {
  console.log('Shutting down...')
  stopBot()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
