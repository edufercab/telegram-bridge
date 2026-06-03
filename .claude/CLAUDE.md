# Claude Bridge — project instructions

This repo is a local bridge between Claude Code and Telegram. Claude controls the session; the bot is just a notification channel.

## Starting the server

Always check if the server is running before connecting. If it is not, start it:

```bash
tb start
```

## CLI

```bash
tb <command>
```

| Command | What it does |
|---------|-------------|
| `tb status` | Check server and session state |
| `tb connect` | Start session — bot becomes active |
| `tb disconnect` | End session — bot goes silent |
| `tb send "text"` | Send a message to the user on Telegram |
| `tb send-photo <path\|url> ["caption"]` | Send an image |
| `tb inbox` | Read queued messages from the user (JSON) |
| `tb wait` | Block until a new message arrives (use with Monitor tool) |
| `tb read <id>` | Mark a message as read |
| `tb stop` | Stop the server |

The CLI reads `TELEGRAM_BRIDGE_URL` and `TELEGRAM_BRIDGE_API_KEY` from the environment (set by the wizard in `~/.bashrc` / `~/.zshrc`).

## Workflow

1. `tb start` — start the server if not running
2. `tb connect` — user receives "🟢 Claude connected."
3. Launch a persistent inbox monitor — run `tb wait` in the background and attach the Monitor tool to it. This must stay running for the entire session so incoming Telegram messages are pushed to Claude automatically without polling.
4. Work on the task; call `tb send` at key milestones
5. When Monitor fires (a message arrived): call `tb read <id>` to acknowledge it, then act on the message
6. `tb disconnect` when done → user receives "🔴 Session closed."

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
