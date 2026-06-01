#!/usr/bin/env node
import type { InboxMessage, ApiResponse, SessionStatus } from './types'

const BASE_URL = process.env['TELEGRAM_BRIDGE_URL'] ?? 'http://localhost:3001'
const API_KEY = process.env['TELEGRAM_BRIDGE_API_KEY'] ?? ''

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
}

const [, , command, ...args] = process.argv

function die(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const data = (await res.json()) as ApiResponse<T>
  return data
}

async function main(): Promise<void> {
  switch (command) {
    case 'status': {
      const res = await fetch(`${BASE_URL}/health`)
      const data = (await res.json()) as {
        status: string
        uptime: number
        session: { active: boolean; started_at: string | null }
      }
      const icon = data.session.active ? '🟢' : '🔴'
      console.log(`Server: ${data.status} | Uptime: ${data.uptime}s | Session: ${icon} ${data.session.active ? 'active' : 'inactive'}`)
      if (data.session.active && data.session.started_at) {
        console.log(`  Started: ${data.session.started_at}`)
      }
      break
    }

    case 'connect': {
      const data = await request<{ started_at: string }>('/session/start', { method: 'POST' })
      if (!data.success) die(data.error?.message ?? 'Failed to start session')
      console.log(`Session started: ${data.data?.started_at}`)
      break
    }

    case 'disconnect': {
      const data = await request('/session/end', { method: 'POST' })
      if (!data.success) die(data.error?.message ?? 'Failed to end session')
      console.log('Session closed 🔴')
      break
    }

    case 'send': {
      const text = args.join(' ')
      if (!text) die('Usage: cli send "message text"')
      const data = await request<{ telegram_message_id: number; chunks_sent: number }>('/send', {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      if (!data.success) die(data.error?.message ?? 'Failed to send message')
      console.log(`Sent (msg_id: ${data.data?.telegram_message_id}, parts: ${data.data?.chunks_sent})`)
      break
    }

    case 'send-photo': {
      const source = args[0]
      const caption = args.slice(1).join(' ') || undefined
      if (!source) die('Usage: cli send-photo <path-or-url> ["optional caption"]')
      const data = await request<{ telegram_message_id: number }>('/send-photo', {
        method: 'POST',
        body: JSON.stringify({ source, caption }),
      })
      if (!data.success) die(data.error?.message ?? 'Failed to send photo')
      console.log(`Photo sent (msg_id: ${data.data?.telegram_message_id})`)
      break
    }

    case 'inbox': {
      const data = await request<InboxMessage[]>('/inbox')
      if (!data.success) die(data.error?.message ?? 'Failed to read inbox')
      const messages = data.data ?? []
      if (messages.length === 0) {
        console.log('Inbox empty 📭')
      } else {
        console.log(JSON.stringify(messages, null, 2))
      }
      break
    }

    case 'read': {
      const id = args[0]
      if (!id) die('Usage: cli read <message-id>')
      const data = await request(`/inbox/${id}`, { method: 'DELETE' })
      if (!data.success) die(data.error?.message ?? 'Failed to mark message as read')
      console.log(`Message ${id} marked as read`)
      break
    }

    case 'session': {
      const data = await request<SessionStatus>('/session')
      if (!data.success) die(data.error?.message ?? 'Failed to get session')
      console.log(JSON.stringify(data.data, null, 2))
      break
    }

    default: {
      console.log('telegram-bridge CLI\n')
      console.log('Commands:')
      console.log('  status                         Server and session status (no auth required)')
      console.log('  connect                        Start a session (bot becomes active)')
      console.log('  disconnect                     End the session (bot goes offline)')
      console.log('  send "text"                    Send a text message to Telegram')
      console.log('  send-photo <path|url> ["cap"]  Send an image to Telegram')
      console.log('  inbox                          List unread messages from Telegram (JSON)')
      console.log('  read <id>                      Mark a message as read (delete from inbox)')
      console.log('  session                        Detailed session status (JSON)')
      console.log('\nEnvironment variables:')
      console.log('  TELEGRAM_BRIDGE_URL            Default: http://localhost:3001')
      console.log('  TELEGRAM_BRIDGE_API_KEY        Must match API_KEY in server .env')
      process.exit(1)
    }
  }
}

main().catch((err: Error) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
