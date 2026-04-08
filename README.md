# Ghosted

Ghosted is a Next.js community platform for the Ghosted Old School RuneScape clan.

Current production shape:

- one **Next.js 16** app (`src/app`)
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

Local env files:

- Next dev and the `dev:stack` helpers both pick up `.env`, `.env.development`, `.env.local`, and `.env.development.local`
- Common local setup vars:
  - `ENABLE_DEV_AUTH=true` to enable `/auth/dev-login`
  - `AUTH_SECRET` is optional locally; if unset, development uses a built-in fallback secret
  - `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` for real Discord sign-in
  - `DISCORD_REDIRECT_URI` if you want Discord OAuth to use one fixed registered callback URI
  - `DISCORD_GUILD_ID` and `DISCORD_BOT_TOKEN` for live Discord role sync
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

- `npm run dev:stack` - start the local Next.js dev server in the background
- `npm run dev:stack:restart` - restart the local Next.js dev server
- `npm run dev:stack:stop` - stop the local Next.js dev server
- `npm run dev:stack:status` - show whether the local Next.js dev server is running
- `npm run dev:stack:logs` - tail the local dev logs

If you prefer bash:

```bash
./scripts/dev-stack.sh start
./scripts/dev-stack.sh restart
./scripts/dev-stack.sh stop
```

Runtime pid files and logs are written to `data/dev-runtime/`.

## Scripts

- `npm run dev` - start Next.js in development mode
- `npm run dev:stack` - start the local dev process in the background
- `npm run dev:stack:restart` - restart the local dev process
- `npm run dev:stack:stop` - stop the local dev process
- `npm run dev:stack:status` - show local dev process status
- `npm run dev:stack:logs` - tail local dev logs
- `npm run build` - production build
- `npm run start` - run the built Next.js app
- `npm run typecheck` - run TypeScript checks
- `npm run lint` - run ESLint against the current Next.js app
- `npm run lint:fix` - auto-fix safe ESLint issues
- `npm run test:server` - run Vitest coverage for server modules and route contracts
- `npm run git:update` - local workflow helper script
- `scripts/deploy-release.sh` - release-oriented VPS deploy script with lockfile-aware installs and rollback support

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
- Next owns all public and internal `/api/*` routes, including companion asset serving and render endpoints
- `/auth/login`, `/auth/logout`, `/auth/dev-login`, and `/api/auth/*` live in Next/Auth.js plus the legacy-session bridge
- Env file lives at `/etc/ghosted/ghosted.env`
- With `DATABASE_PATH=/var/lib/ghosted/ghosted.db`, uploaded companion assets default to `/var/lib/ghosted/companion-assets/` unless `COMPANION_ASSET_DIR` is set explicitly
- Production builds use Next standalone output and run from `/opt/ghosted/current-web`

Recommended deploy command sequence:

```bash
bash scripts/deploy-release.sh origin/main
```

Rollback example:

```bash
bash scripts/deploy-release.sh rollback
```

The release script validates `DATABASE_PATH` and `COMPANION_ASSET_DIR`, skips `npm ci` when `package-lock.json` is unchanged, copies `assets/companion` into the web release, and only restarts `ghosted-web.service`.

## Additional Docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`deploy/ubuntu-vps.md`](./deploy/ubuntu-vps.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`STYLING_METHOD.md`](./STYLING_METHOD.md)
