import fs from 'fs'
import { Telegraf } from 'telegraf'
import { env } from '../lib/env'
import { TelegramError } from '../lib/errors'
import { markdownToHtml } from '../lib/formatter'
import { getBotMessages } from '../lib/i18n'
import * as db from '../db'

export const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN)

const msg = getBotMessages(env.LANGUAGE)

bot.on('message', async (ctx) => {
  if (ctx.chat.id !== env.TELEGRAM_CHAT_ID) {
    await ctx.reply(msg.unauthorized)
    return
  }

  const session = db.getSession()

  if (!session.active) {
    await ctx.reply(msg.notAvailable)
    return
  }

  const text = 'text' in ctx.message ? ctx.message.text : null
  if (!text) {
    await ctx.reply(msg.textOnly)
    return
  }

  db.insertMessage(ctx.message.message_id, ctx.from?.username ?? null, text)
  db.touchSession()
  await ctx.reply(msg.messageReceived)
})

export async function sendMessage(
  text: string,
  parseMode: 'HTML' | 'plain' = 'HTML',
): Promise<number> {
  try {
    const msg = await bot.telegram.sendMessage(
      env.TELEGRAM_CHAT_ID,
      text,
      parseMode === 'HTML' ? { parse_mode: 'HTML' } : {},
    )
    return msg.message_id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new TelegramError(`Failed to send message: ${message}`)
  }
}

export async function sendPhoto(source: string, caption?: string): Promise<number> {
  const isUrl = source.startsWith('http://') || source.startsWith('https://')
  const formattedCaption = caption ? markdownToHtml(caption) : undefined
  const captionOptions = formattedCaption
    ? { caption: formattedCaption, parse_mode: 'HTML' as const }
    : {}

  try {
    const msg = await bot.telegram.sendPhoto(
      env.TELEGRAM_CHAT_ID,
      isUrl ? source : { source: fs.createReadStream(source) },
      captionOptions,
    )
    return msg.message_id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new TelegramError(`Failed to send photo: ${message}`)
  }
}

export async function startBot(): Promise<void> {
  bot.launch().catch((err) => console.error('Bot launch error:', err))
  await new Promise((resolve) => setTimeout(resolve, 2000))
  console.log('Telegram bot connected and polling')
}

export function stopBot(): void {
  bot.stop('SIGTERM')
}
