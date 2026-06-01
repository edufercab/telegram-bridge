import { Hono } from 'hono'
import * as db from '../db'

export const healthRoute = new Hono().get('/', (c) => {
  const session = db.getSession()
  return c.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    session: {
      active: session.active === 1,
      started_at: session.started_at,
    },
  })
})
