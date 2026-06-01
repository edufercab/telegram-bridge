import { Hono } from 'hono'
import { NotFoundError, ValidationError } from '../lib/errors'
import * as db from '../db'

export const inboxRoute = new Hono()

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
