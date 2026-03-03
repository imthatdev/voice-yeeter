# Voice Yeeter

A TypeScript Discord bot (Node.js 20+) using `discord.js`.

`/yeet minutes:<number>` starts a timer, then disconnects all humans from all voice channels in the guild when it expires :>

## Features

- Slash command: `/yeet`
- Required option: `minutes` (integer)
- Validation: `1` to `180`
- Uses Discord.js voice API: `member.voice.setChannel(null)`
- Permission checks:
  - User must have **Manage Channels**
  - Bot must have **Move Members**
- Responses:
  - Ephemeral confirmation when timer starts
  - Public message when users are disconnected
- Activity status:
  - Shows planned yeet count during the timer
  - Resets to sponsor status after the yeet completes

## Tech Stack

- Node.js 20+
- TypeScript
- discord.js
- dotenv
- Docker (multi-stage image)

## Project Structure

```text
.
├── commands/
│   └── yeet.ts
├── deploy-commands.ts
├── index.ts
├── Dockerfile
├── tsconfig.json
├── package.json
└── .env.example
```

## 1) Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Fill in `.env` values:

```env
BOT_TOKEN=your-bot-token
CLIENT_ID=your-application-client-id
GUILD_ID=your-dev-guild-id
```

> `GUILD_ID` is optional. If set, commands deploy to that guild (fast updates). If omitted, commands deploy globally (can take longer to appear).

## 2) Discord App / Bot Requirements

In the Discord Developer Portal:

- Enable **Guilds** and **Guild Voice States** intents for the bot.
- Invite the bot with permissions including:
  - **Move Members** (required)
  - Read/send permissions for the channel where command confirmations are posted

Users running `/yeet` must have **Manage Channels** in the server.

## 3) Run Locally

Build TypeScript:

```bash
pnpm build
```

Deploy slash commands:

```bash
pnpm deploy
```

Start bot:

```bash
pnpm start
```

Dev mode (no manual compile):

```bash
pnpm dev
```

## 4) Docker (single platform)

Hosted image:

```bash
docker pull iconical/voice-yeeter:latest
```

Run hosted image:

```bash
docker run --rm --env-file .env iconical/voice-yeeter:latest
```

Build image:

```bash
docker build -t iconical/voice-yeeter:latest .
```

Run container:

```bash
docker run --rm --env-file .env iconical/voice-yeeter:latest
```

The container entrypoint auto-runs slash command deployment before starting the bot.
To skip deploy-on-start, set:

```bash
DEPLOY_COMMANDS_ON_START=false
```

### Docker Compose example

Example file: `docker-compose.example.yml`

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
```

## 5) Docker Buildx (multi-platform)

### One-time builder setup

```bash
docker buildx create --name multiarch --use
```

```bash
docker buildx inspect --bootstrap
```

### Build and push multi-platform image

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t iconical/voice-yeeter:latest \
  --push \
  .
```

### Build multi-platform image locally (single-platform load)

`buildx --load` loads only one platform into local Docker (usually your host arch):

```bash
docker buildx build \
  --platform linux/amd64 \
  -t voice-yeeter:local \
  --load \
  .
```

Run local loaded image:

```bash
docker run --rm --env-file .env voice-yeeter:local
```

## Command Behavior

- `/yeet minutes:5`
  - Immediately sends an ephemeral timer confirmation.
  - After 5 minutes, disconnects every non-bot member from voice channels in the guild.
  - Posts a public summary message with the number of disconnected users.

## Troubleshooting

- **Command not showing up**
  - Re-run `pnpm deploy`.
  - If global deploy is used (no `GUILD_ID`), wait for propagation.

- **Bot cannot disconnect users**
  - Ensure bot has **Move Members** permission.
  - Ensure bot role is high enough in role hierarchy.

- **No response to slash command**
  - Verify `BOT_TOKEN` and `CLIENT_ID` in `.env`.
  - Confirm bot is online and in the target server.
