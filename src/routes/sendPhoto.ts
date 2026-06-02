import { Hono } from 'hono'
import fs from 'fs'
import { z } from 'zod'
import { ValidationError, FileNotFoundError } from '../lib/errors'
import { validatePhotoUrl, validateLocalFilePath } from '../lib/security'
import { sendPhoto } from '../services/telegram'
import * as db from '../db'

const bodySchema = z.object({
  source: z.string().min(1).max(2048),
  caption: z.string().max(1024).optional(),
})

export const sendPhotoRoute = new Hono().post('/', async (c) => {
  const raw = await c.req.json().catch(() => {
    throw new ValidationError('Invalid JSON body')
  })

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Validation failed')
  }

  const { source } = parsed.data
  const caption = parsed.data.caption?.replace(/%0D%0A/gi, '\n').replace(/%0[AD]/gi, '\n')
  const isUrl = source.startsWith('http://') || source.startsWith('https://')

  if (isUrl) {
    const check = validatePhotoUrl(source)
    if (!check.valid) throw new ValidationError(check.reason ?? 'Invalid URL')
  } else {
    const check = validateLocalFilePath(source)
    if (!check.valid) throw new ValidationError(check.reason ?? 'Invalid file path')
    if (!fs.existsSync(source)) {
      throw new FileNotFoundError(`File not found: ${source}`)
    }
  }

  const telegramMessageId = await sendPhoto(source, caption)
  db.touchSession()

  return c.json({ success: true, data: { telegram_message_id: telegramMessageId } })
})
