import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { NotFoundError, ValidationError } from '../lib/errors'
import * as db from '../db'
import { bridgeEvents } from '../lib/events'
import type { InboxEvent } from '../lib/events'

export const inboxRoute = new Hono()

inboxRoute.get('/stream', (c) => {
  return streamSSE(c, async (stream) => {
    let done: () => void
    const closed = new Promise<void>((resolve) => { done = resolve })

    const onMessage = async (event: InboxEvent) => {
      await stream.writeSSE({ data: JSON.stringify(event) })
    }

    bridgeEvents.on('inbox:message', onMessage)

    const heartbeat = setInterval(() => {
      stream.write(': ping\n\n').catch(() => { done() })
    }, 30_000)

    stream.onAbort(() => {
      clearInterval(heartbeat)
      bridgeEvents.off('inbox:message', onMessage)
      done()
    })

    await closed
  })
})

inboxRoute.get('/', (c) => {
  const unreadOnly = c.req.query('unread_only') !== 'false'
  const messages = unreadOnly ? db.getUnreadMessages() : db.getAllMessages()
  db.touchSession()
  return c.json({ success: true, data: messages })
})

inboxRoute.delete('/:id', (c) => {
  const rawId = c.req.param('id')
  const id = parseInt(rawId, 10)

  if (isNaN(id) || id <= 0) {
    throw new ValidationError('Message ID must be a positive integer')
  }

  const deleted = db.deleteMessage(id)
  if (!deleted) throw new NotFoundError('Message not found')

  return c.json({ success: true })
})
