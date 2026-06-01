export interface InboxMessage {
  id: number
  telegram_message_id: number
  from_username: string | null
  message: string
  created_at: string
  read: number
}

export interface SessionStatus {
  active: boolean
  started_at: string | null
  last_activity: string | null
}

export interface ApiResponse<T = undefined> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}
