# Claude Bridge — project instructions

This repo is a local bridge between Claude Code and Telegram. Claude controls the session; the bot is just a notification channel.

## Starting the server

Always check if the server is running before connecting. If it is not, start it:

```bash
# Check
curl -s http://localhost:3001/health | grep -q '"status":"ok"' && echo running || echo stopped

# Start in background if stopped (from repo root)
nohup node dist/index.js >> server.log 2>&1 &
```

Wait 2 seconds after starting, then verify with the health check before proceeding.

## CLI

```bash
node claude-sdk/dist/cli.js <command>
```

| Command | What it does |
|---------|-------------|
| `status` | Check server and session state |
| `connect` | Start session — bot becomes active |
| `disconnect` | End session — bot goes silent |
| `send "text"` | Send a message to the user on Telegram |
| `send-photo <path\|url> ["caption"]` | Send an image |
| `inbox` | Read queued messages from the user (JSON) |
| `read <id>` | Mark a message as read |

The CLI reads `TELEGRAM_BRIDGE_URL` and `TELEGRAM_BRIDGE_API_KEY` from the environment (set by the wizard in `~/.bashrc` / `~/.zshrc`).

## Workflow

1. Check server is running (start it if not)
2. `connect` → user receives "🟢 Claude connected."
3. Work on the task; call `send` at key milestones
4. Call `inbox` before each response to check for user input
5. Call `read <id>` to acknowledge each message
6. `disconnect` when done → user receives "🔴 Session closed."

**Disconnect triggers**: inbox message containing "stop", "disconnect", "bye", or "pause".

## Architecture

```
Claude Code  ──HTTP──▶  telegram-bridge server  ──▶  Telegram bot  ──▶  📱 phone
             ◀──────                            ◀──  (inbox poll)
```

- Server: Hono + Node.js (`src/`)
- CLI: thin HTTP client (`claude-sdk/cli.ts`)
- Storage: SQLite via better-sqlite3 (`src/db/`)
- Auth: `X-API-Key` header, constant-time comparison

## Setup (first time)

```bash
pnpm install
pnpm wizard   # interactive — generates .env, builds, patches ~/.claude/CLAUDE.md
pnpm start
```
