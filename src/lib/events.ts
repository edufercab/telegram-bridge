import { EventEmitter } from 'events'

export interface InboxEvent {
  id: number
  telegram_message_id: number
  from_username: string | null
  message: string
  created_at: string
}

export const bridgeEvents = new EventEmitter()
