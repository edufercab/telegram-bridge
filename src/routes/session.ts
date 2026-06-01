import { Hono } from 'hono'
import * as db from '../db'
import { ConflictError, NotFoundError } from '../lib/errors'

export const sessionRoute = new Hono()

sessionRoute.get('/', (c) => {
  const session = db.getSession()
  return c.json({
    success: true,
    data: {
      active: session.active === 1,
      started_at: session.started_at,
      last_activity: session.last_activity,
    },
  })
})

sessionRoute.post('/start', (c) => {
  const session = db.getSession()
  if (session.active === 1) throw new ConflictError('A session is already active')
  db.startSession()
  const updated = db.getSession()
  return c.json({ success: true, data: { started_at: updated.started_at } })
})

sessionRoute.post('/end', (c) => {
  const session = db.getSession()
  if (session.active === 0) throw new NotFoundError('No active session')
  db.endSession()
  return c.json({ success: true })
})
