# Ghosted

Ghosted is a community platform for the Ghosted Old School RuneScape clan, built as:

- a **Next.js frontend** (`src/app`)
- a **Python API/backend** (`server.py`)
- a **SQLite data layer** for rewards, giveaways, casino history, and news publishing
- a **companion avatar app** that lets members spend points on a tiny ghost, equip cosmetics, upload custom asset files, and export a shareable image

The canonical architecture reference is [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech Stack

- Next.js 16, React 19, TypeScript
- Python 3 (`http.server` + SQLite)
- Pixi.js for the casino renderer
- Caddy + systemd for VPS hosting

## Requirements

- Node.js `20.9+`
- Python `3.13` (matches CI)

## Local Development

1. Install frontend deps:

```powershell
npm install
```

2. Start the Python API (default `http://localhost:8000`):

```powershell
python server.py
```

3. Start Next.js:

```powershell
npm run dev
```

4. Open:

```text
http://localhost:3000
```

Companion studio:

```text
http://localhost:3000/app/companion
```

Companion asset storage:

- Hand-authored default Ghostling/base cosmetics live in `assets/companion/defaults/`
- Uploaded companion assets live under `COMPANION_ASSET_DIR/uploads/`
- If `COMPANION_ASSET_DIR` is unset, uploads default to a `companion-assets/` folder beside `DATABASE_PATH`
- Admin users can upload a replacement base plus custom cosmetic layers directly from `/app/companion`
- Raw repo and uploaded files are both served from `/api/companion/assets/...`

### Dev Stack Helper

If you want one command to manage both local processes:

```powershell
npm run dev:stack
```

Available Windows shortcuts:

- `npm run dev:stack` - start the Python API and Next.js dev server in the background
- `npm run dev:stack:restart` - restart both processes
- `npm run dev:stack:stop` - stop both processes
- `npm run dev:stack:status` - show whether each process is running
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
- `npm run dev:stack` - start both local dev processes in the background
- `npm run dev:stack:restart` - restart both local dev processes
- `npm run dev:stack:stop` - stop both local dev processes
- `npm run dev:stack:status` - show local dev process status
- `npm run dev:stack:logs` - tail local dev logs
- `npm run build` - production build
- `npm run start` - run built Next.js app
- `npm run typecheck` - run TypeScript checks
- `npm run lint` - run ESLint against the current Next.js app
- `npm run lint:fix` - auto-fix safe ESLint issues
- `npm run test:backend` - run Python backend tests
- `npm run git:update` - local workflow helper script
- `scripts/deploy-release.sh` - release-oriented VPS deploy script with lockfile-aware installs, targeted restarts, and rollback support

## Validation

Before opening a PR, run:

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:backend
```

## Production Notes

Current VPS pattern:

- Caddy -> Next.js (`ghosted-web.service`) on `127.0.0.1:3000`
- Next now owns core app routes such as `/api/config`, `/api/site-shell`, `/api/me`, `/api/rewards`, `/api/news`, `/api/giveaways`, `/api/hall/dashboard`, and the current admin news/giveaway/operator routes
- The catch-all `/api/[...path]` proxy still forwards unmigrated domains such as companion, casino, and the remaining WOM/profile endpoints to the Python API
- Next owns `/auth/login` and `/api/auth/*`; legacy Python `/auth/discord/*` routes are no longer the primary browser sign-in flow
- Env file at `/etc/ghosted/ghosted.env`
- With `DATABASE_PATH=/var/lib/ghosted/ghosted.db`, uploaded companion assets now default to `/var/lib/ghosted/companion-assets/` unless `COMPANION_ASSET_DIR` is set explicitly
- Production builds now use Next standalone output, and the checked-in service templates target release symlinks under `/opt/ghosted/current-web` and `/opt/ghosted/current-api`

Recommended deploy command sequence:

```bash
bash scripts/deploy-release.sh origin/main --auto
```

Rollback example:

```bash
bash scripts/deploy-release.sh rollback --all
```

The release script validates `DATABASE_PATH` and `COMPANION_ASSET_DIR`, skips `npm ci` when `package-lock.json` is unchanged, and only restarts the web or API service when the changed files require it.

## Additional Docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`deploy/ubuntu-vps.md`](./deploy/ubuntu-vps.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`STYLING_METHOD.md`](./STYLING_METHOD.md)
