import { Hono } from 'hono'
import { z } from 'zod'
import { ValidationError } from '../lib/errors'
import { markdownToHtml, splitMessage } from '../lib/formatter'
import { sendMessage } from '../services/telegram'
import * as db from '../db'

const bodySchema = z.object({
  text: z.string().min(1).max(20_000),
  format: z.enum(['html', 'plain', 'rawhtml']).default('html'),
})

export const sendRoute = new Hono().post('/', async (c) => {
  const raw = await c.req.json().catch(() => {
    throw new ValidationError('Invalid JSON body')
  })

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed')
  }

  const { format } = parsed.data
  const text = parsed.data.text.replace(/%0D%0A/gi, '\n').replace(/%0[AD]/gi, '\n')
  const formatted = format === 'html' ? markdownToHtml(text) : text
  const chunks = splitMessage(formatted)

  let lastMessageId = 0
  for (const chunk of chunks) {
    lastMessageId = await sendMessage(chunk, format !== 'plain' ? 'HTML' : 'plain')
  }

  db.touchSession()
  return c.json({
    success: true,
    data: { telegram_message_id: lastMessageId, chunks_sent: chunks.length },
  })
})
