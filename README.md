# Ghosted

Ghosted is a Next.js community platform for the Ghosted Old School RuneScape clan.

Current production shape:

- one **Next.js 16** app (`src/app`)
- one **Discord worker** host for bot-backed Discord features
- one **scene realtime** websocket sidecar for the public homepage hero
- **SQLite** for users, rewards, giveaways, WOM cache, casino history, and companion state
- a native **Ghostling** system for companion state, admin uploads, asset serving, and SVG rendering
- **Caddy + systemd** on a single Ubuntu VPS

The canonical architecture reference is [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech Stack

- Next.js 16, React 19, TypeScript
- Better SQLite3
- Pixi.js for the casino renderer
- Vitest for server tests
- Caddy + systemd for VPS hosting

## Build and Test Tooling

- `Next.js 16` is the canonical app runtime and build tool for this repository.
- `Vitest` is the dedicated test runner for server modules and route contracts.
- Legacy HTML under `legacy/` is archived reference material and is not part of the supported build or deploy path.

## Requirements

- Node.js `20.9+`

## Local Development

1. Install dependencies:

```powershell
npm install
```

2. Start Next.js:

```powershell
npm run dev
```

Optional Discord worker:

```powershell
npm run dev:discord:worker
```

Optional homepage scene realtime service:

```powershell
npm run dev:scene:realtime
```

Local env files:

- Next dev and the `dev:stack` helpers both pick up `.env`, `.env.development`, `.env.local`, and `.env.development.local`
- Common local setup vars:
  - `ENABLE_DEV_AUTH=true` to enable `/auth/dev-login`
  - `DEV_AUTH_ADMIN=true` if you want `/auth/dev-login` to create an admin session by default during local development
  - `AUTH_SECRET` is optional locally; if unset, development uses a built-in fallback secret
  - `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` for real Discord sign-in
  - `DISCORD_REDIRECT_URI` if you want Discord OAuth to use one fixed registered callback URI
  - `DISCORD_GUILD_ID` and `DISCORD_BOT_TOKEN` for live Discord role sync
  - `TWITCH_OPERATOR_DISCORD_IDS` to allow specific Discord users into the Twitch operator surfaces at `/v/twitch` and `/v/giveaways`
  - `TWITCH_GAME_OPERATOR_DISCORD_IDS` remains as a temporary compatibility fallback for older giveaway-only setups
  - `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`, and `TWITCH_EVENTSUB_SECRET` for the Ghosted Twitch platform, loot chest console, and webhook
  - `AUTH_URL` or `PUBLIC_BASE_URL` so the Twitch EventSub callback can advertise the correct public URL
  - `WOM_GROUP_ID` for clan/WOM endpoints
  - `DATABASE_PATH` and `COMPANION_ASSET_DIR` if you want to override the local defaults

3. Open:

```text
http://localhost:3000
```

Companion studio:

```text
http://localhost:3000/hall/ghostling
```

Twitch loot chest console:

```text
http://localhost:3000/v/giveaways
```

Twitch operator home:

```text
http://localhost:3000/v/twitch
```

Companion asset storage:

- Hand-authored Ghostling assets live in `assets/companion/`
- Uploaded companion assets live under `COMPANION_ASSET_DIR/uploads/`
- If `COMPANION_ASSET_DIR` is unset, uploads default to a `companion-assets/` folder beside `DATABASE_PATH`
- Raw repo and uploaded files are both served from `/api/companion/assets/...`

### Dev Stack Helper

If you want one command to manage the local Next.js process:

```powershell
npm run dev:stack
```

Available Windows shortcuts:

- `npm run dev:stack` - start the local Next.js dev server and scene realtime service in the background
- `npm run dev:stack:restart` - restart the local background dev services
- `npm run dev:stack:stop` - stop the local background dev services
- `npm run dev:stack:status` - show whether the local background dev services are running
- `npm run dev:stack:logs` - tail the local dev logs

If you prefer bash:

```bash
./scripts/dev-stack.sh start
./scripts/dev-stack.sh restart
./scripts/dev-stack.sh stop
```

Runtime pid files and logs are written to `data/dev-runtime/`.

Foreground sidecars:

- `npm run dev:discord:worker` - run the Discord worker in a separate terminal
- `npm run dev:presence:worker` - compatibility alias for the current `voicePresence` worker module host
- `npm run dev:scene:realtime` - run the homepage scene realtime websocket service

## Scripts

- `npm run dev` - start Next.js in development mode
- `npm run dev:stack` - start the local dev process in the background
- `npm run dev:stack:restart` - restart the local dev process
- `npm run dev:stack:stop` - stop the local dev process
- `npm run dev:stack:status` - show local dev process status
- `npm run dev:stack:logs` - tail local dev logs
- `npm run dev:discord:worker` - run the Discord worker in development
- `npm run dev:presence:worker` - compatibility alias for the Discord worker
- `npm run dev:scene:realtime` - run the homepage scene realtime websocket service in development
- `npm run discord:worker` - run the Discord worker entrypoint directly
- `npm run discord:presence:worker` - compatibility alias for the Discord worker
- `npm run scene:realtime` - run the homepage scene realtime websocket service directly
- `npm run build` - production build
- `npm run start` - run the built Next.js app
- `npm run typecheck` - run TypeScript checks
- `npm run lint` - run ESLint against the current Next.js app
- `npm run lint:fix` - auto-fix safe ESLint issues
- `npm run test:server` - run Vitest coverage for server modules and route contracts
- `npm run git:update` - local workflow helper script
- `scripts/deploy-release.sh` - optional release-oriented VPS helper script; not the current primary production workflow

Legacy note:

- `legacy/` is preserved for reference only. Do not treat it as an active app surface or a separate build target.

## Validation

Before opening a PR, run:

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:server
```

## Production Notes

Current VPS pattern:

- Caddy -> Next.js (`ghosted-web.service`) on `127.0.0.1:3000`
- Caddy -> scene realtime websocket sidecar (`ghosted-scene-realtime.service`) on `127.0.0.1:3001` for `/ws/scene/presence`
- optional Discord worker (`ghosted-discord-worker.service`) for bot-backed Discord features
- Next owns all public and internal `/api/*` routes, including companion asset serving and render endpoints
- The Twitch platform control plane lives at `/v/twitch`, while the loot chest giveaway console stays at `/v/giveaways` and its OBS/browser-source overlay stays at `/v/giveaways/overlay/[token]`
- `/auth/login`, `/auth/logout`, `/auth/dev-login`, and `/api/auth/*` live in Next/Auth.js plus the legacy-session bridge
- `/admin/discord-presence/` is the operator surface for worker health, current public mode, and the public voice/stage allowlist
- Env file lives at `/etc/ghosted/ghosted.env`
- Twitch EventSub notifications terminate on the Next route `/api/v/twitch/eventsub`, using `AUTH_URL` or `PUBLIC_BASE_URL` to form the public callback URL
- With `DATABASE_PATH=/var/lib/ghosted/ghosted.db`, uploaded companion assets default to `/var/lib/ghosted/companion-assets/` unless `COMPANION_ASSET_DIR` is set explicitly
- Production builds use Next standalone output and run from `/opt/ghosted/.next/standalone/server.js`

Current deploy workflow:

1. Push local changes to a feature branch.
2. Open a PR to `main`.
3. Merge the PR.
4. On the VPS, update and restart the web app:

```bash
cd /opt/ghosted
sudo git pull
sudo npm run build
sudo systemctl restart ghosted-web
```

If a deploy changes the Discord worker code, env, or service wiring, also restart it:

```bash
sudo systemctl restart ghosted-discord-worker
```

If a deploy changes the homepage realtime websocket code, env, or proxy wiring, also restart it:

```bash
sudo systemctl restart ghosted-scene-realtime
```

The release script still exists for experiments and rollback work, but it is not the current production deploy path.

## Additional Docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`deploy/discord-worker.md`](./deploy/discord-worker.md)
- [`deploy/discord-presence-worker.md`](./deploy/discord-presence-worker.md)
- [`deploy/ubuntu-vps.md`](./deploy/ubuntu-vps.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`STYLING_METHOD.md`](./STYLING_METHOD.md)
