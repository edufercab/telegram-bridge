# telegram-bridge

**Claude works. You get updates on your phone.**

A local server that turns Telegram into Claude Code's notification channel — Claude decides when to connect, sends you progress updates, reads your replies, and disconnects when done. No babysitting the terminal required.

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## The problem

You ask Claude to work on something for an hour. You have two options:

- **Stare at the terminal** waiting for it to finish
- **Walk away** and have no idea when it's done or if it got stuck

telegram-bridge gives you a third option: Claude pings you on Telegram.

---

## How it works

```
┌─────────────────────────────────────────────────────────┐
│                     YOUR MACHINE                        │
│                                                         │
│  ┌──────────────┐   HTTP API    ┌───────────────────┐   │
│  │  Claude Code │ ──────────── ▶│ telegram-bridge   │   │
│  │  (terminal)  │ ◀──────────── │ (local server)    │   │
│  └──────────────┘   inbox poll │                   │   │
│                                │  Telegraf bot     │   │
│                                │  (long-polling)   │   │
│                                └────────┬──────────┘   │
└─────────────────────────────────────────┼───────────────┘
                                          │ Telegram API
                                          ▼
                                   📱 Your phone
```

**Claude is in control** — not the other way around:

1. Claude runs `cli connect` → bot activates, you get "🟢 Claude connected"
2. Claude works, runs `cli send "..."` to update you at key milestones
3. You reply from your phone → message queues in SQLite
4. Claude polls `cli inbox` to read your replies
5. Claude runs `cli disconnect` when done → bot goes silent

When Claude is not connected, the bot replies **"Claude is not available right now. 🔴"** to any message — no phantom responses.

> **This is different from [cc-connect](https://github.com/chenhg5/cc-connect) and [claude-code-telegram](https://github.com/RichardAtCT/claude-code-telegram)**, which spawn Claude as a subprocess controlled by the bot. Here, Claude is the actor — the bot is just a channel.

---

## Features

- **Claude-controlled sessions** — Claude connects and disconnects explicitly; the bot stays silent otherwise
- **Persistent inbox** — your Telegram messages queue in SQLite even if Claude is mid-task; nothing is lost
- **Auto-expiry** — idle sessions close automatically after N minutes with a Telegram notification
- **Markdown → Telegram HTML** — Claude's formatted responses render correctly on mobile
- **Photo support** — Claude can send local files or URLs to Telegram with optional captions
- **Long-polling** — no public IP, no webhook, no ngrok required
- **Security-first** — constant-time API key comparison, SSRF protection, path traversal prevention, body size caps
- **Zero cloud** — runs entirely on your machine; your messages never leave it

---

## Quickstart

```bash
git clone https://github.com/edufercab/telegram-bridge.git ~/telegram-bridge
cd ~/telegram-bridge
pnpm install
pnpm setup      # interactive wizard — handles everything below automatically
```

The wizard will:
- Generate a secure API key
- Validate your bot token with Telegram
- **Auto-detect your Chat ID** — just send any message to your bot when prompted
- Write `.env` with mode 600
- Build the project
- Add env vars to your shell profile (`~/.bashrc` / `~/.zshrc`)
- Patch `~/.claude/CLAUDE.md` with the bridge instructions for Claude
- Optionally generate a systemd service file for autostart

Then start the server:

```bash
pnpm start
```

Check it's alive:

```bash
curl http://localhost:3001/health
# {"status":"ok","uptime":5,"session":{"active":false,"started_at":null}}
```

---

## Claude integration

### Global CLAUDE.md

Add this block to `~/.claude/CLAUDE.md` (create if it doesn't exist):

````markdown
## Telegram Bridge

A local bridge is running at `~/telegram-bridge` that lets you send updates to the user via Telegram and receive their replies — bidirectionally.

**Activate only when the user explicitly asks you to connect.**

### CLI (run via bash)

```bash
node ~/telegram-bridge/claude-sdk/dist/cli.js <command>
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

### Required env vars (add to ~/.bashrc or ~/.zshrc)

```bash
export TELEGRAM_BRIDGE_URL=http://localhost:3001
export TELEGRAM_BRIDGE_API_KEY=<same value as API_KEY in .env>
```

### Workflow

1. `connect` → sends "🟢 Claude connected." to the user
2. Work on the task; call `send` at key milestones
3. Call `inbox` before each response to check for user input
4. Call `read <id>` to acknowledge each message
5. `disconnect` when done → sends "🔴 Session closed."

**Disconnect triggers**: inbox message containing "stop", "disconnect", "bye", "pause", or similar.
````

### Build the CLI

```bash
pnpm build
```

The compiled CLI lands at `claude-sdk/dist/cli.js`.

---

## API reference

All endpoints except `/health` require `X-API-Key: <your-key>`.

Every response follows `{ success: boolean, data?: ..., error?: { code, message } }`.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Server status + session state (no auth) |
| `GET` | `/session` | Detailed session info |
| `POST` | `/session/start` | Claude connects |
| `POST` | `/session/end` | Claude disconnects |
| `POST` | `/send` | Send text to Telegram |
| `POST` | `/send-photo` | Send image to Telegram |
| `GET` | `/inbox` | Read queued user messages |
| `DELETE` | `/inbox/:id` | Mark message as read |

<details>
<summary>Endpoint details</summary>

#### POST /send

```json
{ "text": "Your message here", "format": "html" }
```

- `format`: `"html"` (default, converts markdown to Telegram HTML) or `"plain"`
- Messages longer than 4000 chars are split automatically

#### POST /send-photo

```json
{ "source": "/absolute/path/to/image.png", "caption": "optional caption" }
{ "source": "https://example.com/image.jpg", "caption": "optional" }
```

- Local files: absolute path, allowed extensions: `.png .jpg .jpeg .gif .webp .bmp`
- Remote URLs: only `http`/`https`; private IP ranges are blocked

#### GET /inbox

```
GET /inbox          → unread messages only (default)
GET /inbox?unread_only=false  → all messages
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "telegram_message_id": 42,
      "from_username": "yourhandle",
      "message": "how is it going?",
      "created_at": "2026-06-01T10:30:00"
    }
  ]
}
```

</details>

---

## Auto-start (Linux)

```bash
sudo tee /etc/systemd/system/telegram-bridge.service > /dev/null << EOF
[Unit]
Description=Telegram Bridge
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/telegram-bridge
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=5
EnvironmentFile=$HOME/telegram-bridge/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now telegram-bridge
systemctl status telegram-bridge
```

---

## Security

| Layer | Implementation |
|-------|---------------|
| API key auth | Constant-time comparison (`crypto.timingSafeEqual`) prevents timing attacks |
| SSRF prevention | `/send-photo` URLs are validated — private IP ranges and localhost are blocked |
| Path traversal | Local file paths are resolved and extension-checked before opening |
| Input validation | Zod schemas on all endpoints; startup exits if env vars are invalid |
| Body size cap | 64 KB limit on all requests |
| Secrets in logs | API key and bot token are never logged |
| Chat allowlist | Only your `TELEGRAM_CHAT_ID` can send messages to the bot |
| DB safety | Prepared statements only; WAL mode for integrity |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | ✅ | Secret key (≥ 32 chars). Generate: `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | Your numeric Telegram chat ID |
| `PORT` | — | Server port (default: `3001`) |
| `SESSION_TIMEOUT_MINUTES` | — | Idle session expiry in minutes (default: `30`) |
| `NODE_ENV` | — | `development` or `production` (default: `development`) |

---

## Why not cc-connect or claude-code-telegram?

Those tools use the **inverse pattern**: the Telegram bot is always on, and it spawns Claude as a subprocess when you message it. They're great for "remote access to Claude from your phone."

telegram-bridge is for a different workflow: **Claude is already running a long task in your terminal and you want to stay in the loop from your phone.** Claude controls when it's reachable.

| | cc-connect | claude-code-telegram | telegram-bridge |
|--|--|--|--|
| Who initiates? | You (via Telegram) | You (via Telegram) | Claude (via CLI) |
| Claude awareness | Subprocess | Subprocess | First-class actor |
| Bot when idle | Always responds | Always responds | "Not available 🔴" |
| Async workflow | ❌ | ❌ | ✅ |
| No public IP | ✅ | ✅ | ✅ |

---

## Contributing

Issues and PRs welcome. Please keep changes focused — one concern per PR.

---

## License

MIT
