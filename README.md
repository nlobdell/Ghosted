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

## Scripts

- `npm run dev` - start Next.js in development mode
- `npm run build` - production build
- `npm run start` - run built Next.js app
- `npm run typecheck` - run TypeScript checks
- `npm run lint` - run ESLint against the current Next.js app
- `npm run lint:fix` - auto-fix safe ESLint issues
- `npm run test:backend` - run Python backend tests
- `npm run git:update` - local workflow helper script

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
- Next proxies app data requests to the Python API with route handlers under `/api/*`
- Next owns `/auth/login` and `/api/auth/*`; legacy Python `/auth/discord/*` routes are no longer the primary browser sign-in flow
- Env file at `/etc/ghosted/ghosted.env`
- With `DATABASE_PATH=/var/lib/ghosted/ghosted.db`, uploaded companion assets now default to `/var/lib/ghosted/companion-assets/` unless `COMPANION_ASSET_DIR` is set explicitly

Typical deploy command sequence:

```bash
git pull
npm install
npm run build
sudo systemctl restart ghosted-web
```

If backend logic changed, restart the Python API service too.

## Additional Docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`deploy/ubuntu-vps.md`](./deploy/ubuntu-vps.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`STYLING_METHOD.md`](./STYLING_METHOD.md)
