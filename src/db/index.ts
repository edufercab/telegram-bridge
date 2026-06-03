import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

fs.mkdirSync('./data', { recursive: true })

const db = new Database('./data/telegram-bridge.db')

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('synchronous = NORMAL')

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)

export interface Session {
  id: number
  active: number
  started_at: string | null
  last_activity: string | null
}

export interface InboxMessage {
  id: number
  telegram_message_id: number
  from_username: string | null
  message: string
  created_at: string
  read: number
}

const stmts = {
  getSession: db.prepare<[], Session>('SELECT * FROM session WHERE id = 1'),
  startSession: db.prepare(
    "UPDATE session SET active = 1, started_at = datetime('now'), last_activity = datetime('now') WHERE id = 1",
  ),
  endSession: db.prepare(
    'UPDATE session SET active = 0, started_at = NULL, last_activity = NULL WHERE id = 1',
  ),
  touchSession: db.prepare("UPDATE session SET last_activity = datetime('now') WHERE id = 1"),
  insertMessage: db.prepare<[number, string | null, string], Database.RunResult>(
    'INSERT INTO inbox_messages (telegram_message_id, from_username, message) VALUES (?, ?, ?)',
  ),
  getUnread: db.prepare<[], InboxMessage>(
    'SELECT * FROM inbox_messages WHERE read = 0 ORDER BY created_at ASC',
  ),
  getAll: db.prepare<[], InboxMessage>(
    'SELECT * FROM inbox_messages ORDER BY created_at ASC',
  ),
  markRead: db.prepare<[number], Database.RunResult>(
    'UPDATE inbox_messages SET read = 1 WHERE id = ?',
  ),
  deleteMessage: db.prepare<[number], Database.RunResult>(
    'DELETE FROM inbox_messages WHERE id = ?',
  ),
}

export function getSession(): Session {
  return stmts.getSession.get() as Session
}

export function startSession(): void {
  stmts.startSession.run()
}

export function endSession(): void {
  stmts.endSession.run()
}

export function touchSession(): void {
  stmts.touchSession.run()
}

export function insertMessage(
  telegramMessageId: number,
  fromUsername: string | null,
  message: string,
): number {
  const result = stmts.insertMessage.run(telegramMessageId, fromUsername, message)
  return result.lastInsertRowid as number
}

export function getUnreadMessages(): InboxMessage[] {
  return stmts.getUnread.all()
}

export function getAllMessages(): InboxMessage[] {
  return stmts.getAll.all()
}

export function markMessageRead(id: number): boolean {
  const result = stmts.markRead.run(id)
  return result.changes > 0
}

export function deleteMessage(id: number): boolean {
  const result = stmts.deleteMessage.run(id)
  return result.changes > 0
}

export { db }
