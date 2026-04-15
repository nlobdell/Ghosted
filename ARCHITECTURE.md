# Ghosted Architecture

## 1. System Overview

Ghosted is a Next.js web app with one additional worker process for Discord integration:

- **Next.js (React 19 + App Router)** serves the UI and all `/api/*` routes on port `3000`
- **Discord worker** is a separate Node process that owns the shared Discord Gateway client and registered worker modules
- **SQLite** stores users, sessions, rewards, giveaways, Twitch platform state, WOM cache, casino history, companion state, and Discord presence foundation tables
- **Caddy** terminates TLS and reverse proxies public traffic to the Next.js web service
- **Vitest** covers server modules and route contracts as the repository test runner

There is no separate Python API process anymore.
There is also no separate supported casino build pipeline; archived HTML under `legacy/` is reference-only.

## 2. Runtime Topology

```text
Browser
  -> Caddy (443)
  -> Next.js web (ghosted-web.service, :3000)
  -> Discord worker (ghosted-discord-worker.service)
  -> SQLite (/var/lib/ghosted/ghosted.db)
  -> Companion asset storage (/var/lib/ghosted/companion-assets)
```

## 3. Repository Shape

### App and APIs

- [`src/app`](./src/app): route tree, layouts, and route handlers
- [`src/components`](./src/components): shared UI
- [`src/lib`](./src/lib): server helpers, auth bridge, domain modules, shared types
- [`src/casino`](./src/casino): casino runtime modules and Pixi renderer

### Operations

- [`deploy`](./deploy): service files, env example, and VPS notes
- [`scripts`](./scripts): deploy helper, local dev process helpers, and workflow scripts
- Companion uploads live in `COMPANION_ASSET_DIR` or, by default, beside `DATABASE_PATH`
- [`legacy`](./legacy): archived pre-Next reference assets, not part of the live build or deploy path

## 4. Route Architecture

### Public

- `/`
- `/news/`
- `/news/:slug`

### Member app

- `/hall/`
- `/hall/clan/`
- `/hall/competitions/`
- `/hall/rewards/`
- `/hall/profile/`
- `/hall/casino/`
- `/hall/ghostling/`

### Admin

- `/admin/`

### Private operator tools

- `/v/twitch/`
- `/v/giveaways/`
- `/v/giveaways/host/`
- `/v/giveaways/overlay/:token`

## 5. API Domains

Implemented by route handlers under [`src/app/api`](./src/app/api) and shared server modules under [`src/lib/server`](./src/lib/server):

- `/api/config`
- `/api/site-shell`
- `/api/me`
- `/api/wom/*`
- `/api/profile/wom-link`
- `/api/rewards`
- `/api/news`
- `/api/news/:slug`
- `/api/giveaways`
- `/api/giveaways/:id/enter`
- `/api/v/twitch/*`
- `/api/v/giveaways/state`
- `/api/v/giveaways/twitch/*`
- `/api/v/giveaways/turns/:id/*`
- `/api/hall/dashboard`
- `/api/casino/games`
- `/api/casino/spin`
- `/api/companion`
- `/api/companion/purchase`
- `/api/companion/equip`
- `/api/companion/admin/*`
- `/api/companion/assets/*`
- `/api/companion/render`
- `/api/companion/render-animated`
- `/api/admin/*`
- `/api/auth/*`
- `/auth/login`
- `/auth/logout`
- `/auth/dev-login`

## 6. Domain Modules

Shared backend logic is organized by domain:

- [`src/lib/server/ghosted-api.ts`](./src/lib/server/ghosted-api.ts): site shell, current-user helpers, hall dashboard, giveaways, and news reads
- [`src/lib/server/ghosted-admin.ts`](./src/lib/server/ghosted-admin.ts): admin news, giveaways, rewards, and WOM refresh flows
- [`src/lib/server/wom.ts`](./src/lib/server/wom.ts): Wise Old Man API, caching, clan payloads, roster, competitions, and link state
- [`src/lib/server/casino.ts`](./src/lib/server/casino.ts): games, spins, cooldowns, wager caps, and bonus state
- [`src/lib/server/rewards.ts`](./src/lib/server/rewards.ts): balance and ledger writes
- [`src/lib/server/twitch-platform.ts`](./src/lib/server/twitch-platform.ts): shared Twitch auth, broadcaster connections, EventSub delivery persistence, replay-ready processing seams, and operator state
- [`src/lib/server/twitch-loot-chest.ts`](./src/lib/server/twitch-loot-chest.ts): giveaway module reward sync, loot chest turn state, and overlay data on top of the shared Twitch platform
- [`src/lib/server/companion.ts`](./src/lib/server/companion.ts): Ghostling state, purchases, loadouts, and admin mutations
- [`src/lib/server/companion-storage.ts`](./src/lib/server/companion-storage.ts): asset-path normalization, storage roots, uploads, repo asset lookup, rig/animation metadata
- [`src/lib/server/companion-render.ts`](./src/lib/server/companion-render.ts): static and animated SVG render output plus public preview resolution

## 7. Auth and Sessions

- Primary browser auth uses Auth.js with Discord
- `getCurrentUser()` first checks the Auth.js session, then falls back to the legacy `ghosted_session` cookie stored in SQLite
- `/auth/dev-login` stays available only when `ENABLE_DEV_AUTH=true` and still creates the legacy session row/cookie for local and VPS debugging
- `/v/twitch` and `/v/giveaways` are separately gated by `TWITCH_OPERATOR_DISCORD_IDS`, with `TWITCH_GAME_OPERATOR_DISCORD_IDS` supported as a temporary compatibility fallback
- `/v/giveaways/overlay/:token` stays tokenized and unauthenticated for OBS/browser-source embeds

## 8. Deployment Architecture

Observed production stack:

- Caddy serves the public domain and proxies to `127.0.0.1:3000`
- `ghosted-web.service` runs the standalone Next bundle from `/opt/ghosted/.next/standalone/server.js`
- `ghosted-discord-worker.service` is the Node worker host for bot-backed Discord sync and worker health persistence
- Environment and secrets come from `/etc/ghosted/ghosted.env`
- The live checkout stays at `/opt/ghosted`, and `npm run build` refreshes the in-place standalone runtime bundle there

Typical deploy workflow:

1. Push local changes to a feature branch.
2. Open a PR to `main`.
3. Merge the PR.
4. On the VPS:
   `cd /opt/ghosted`
   `sudo git pull`
   `sudo npm run build`
   `sudo systemctl restart ghosted-web`

If the deploy also changes the Discord worker, restart `ghosted-discord-worker` separately after the build. The `scripts/deploy-release.sh` helper still exists, but it is not the primary production workflow described here.

## 9. Editing Guidance

### Where to edit

- New or changed page layout: `src/app/**/page.tsx`
- Route handlers: `src/app/api/**/route.ts`
- Shared app components: `src/components/**`
- Theme and spacing: `src/app/globals.css`
- Domain logic: `src/lib/server/**`
- Casino behavior: `src/components/ui/CasinoGame.tsx` and `src/casino/game/*`

### Principles

- Keep public and app surfaces in the same design system
- Prefer shared primitives over page-specific one-offs
- Keep API contracts aligned with the existing frontend callsites
- Keep runtime-owned filesystem paths outside the release bundle except for repo assets intentionally copied into the standalone release
