# Ghosted Architecture

## 1. System Overview

Ghosted is a split-stack web app:

- **Next.js (React 19 + App Router)** serves the UI on port `3000`.
- **Python API (`server.py`)** still serves the remaining unmigrated domains (typically port `8000`).
- **Caddy** terminates TLS and reverse proxies public traffic to the Next.js web service.

In production, the frontend and backend are separate processes with a shrinking proxy boundary between them.

## 2. Runtime Topology

```text
Browser
  -> Caddy (443)
  -> Next.js web (ghosted-web.service, :3000)
  -> Native Next route handlers serve migrated /api/* domains
  -> Next catch-all proxy forwards remaining /api/* domains to Python API (:8000)
  -> SQLite (/var/lib/ghosted/ghosted.db)
```

### Mixed API contract (Next + Python)

Implemented by the Next route handlers and helpers under [`src/app/api`](./src/app/api) and [`src/lib/server`](./src/lib/server):

- Native Next handlers now own `/api/config`, `/api/site-shell`, `/api/me`, `/api/rewards`, `/api/news`, `/api/giveaways`, `/api/hall/dashboard`, and the current admin news/giveaway/operator routes
- `/api/:path*` is still proxied where the Next app relies on Python-backed data such as companion, casino, and the remaining WOM/profile flows
- `/auth/login` and `/api/auth/*` stay in Next/Auth.js
- Legacy Python `/auth/discord/*` endpoints still exist in `server.py`, but they are not the primary public sign-in entrypoint

Default `PYTHON_API_URL` is `http://localhost:8000`.

## 3. Repository Shape

### Frontend (Next.js)

- [`src/app`](./src/app): route tree and layouts
- [`src/components`](./src/components): nav, auth widget, shared app UI primitives
- [`src/lib`](./src/lib): API helpers, shared types, navigation config
- [`src/casino`](./src/casino): casino runtime modules (Pixi renderer + assets)

### Backend

- [`server.py`](./server.py): monolithic HTTP server, auth/session logic, API endpoints, SQLite data operations
- [`tests`](./tests): backend tests
- Companion uploads are stored in `COMPANION_ASSET_DIR` or, by default, in a `companion-assets/` sibling directory next to `DATABASE_PATH`

### Operations

- [`deploy`](./deploy): deploy reference files and VPS notes
- [`scripts`](./scripts): workflow scripts (including git update helper)

## 4. Route Architecture

### Public

- `/` - app-forward landing surface
- `/news/`, `/news/:slug` - public clan news feed and post detail

### Member app

- `/app/` - member command center
- `/app/community/`, `/app/clan/`, `/app/competitions/`
- `/app/rewards/`, `/app/giveaways/`, `/app/profile/`
- `/app/casino/`

### Admin

- `/admin/`

All pages rely on the same design system in [`src/app/globals.css`](./src/app/globals.css) and shared primitives in [`src/components/app/AppUI.tsx`](./src/components/app/AppUI.tsx).

## 5. Data and API Boundaries

### Frontend API helpers

- General app helpers: [`src/lib/api.ts`](./src/lib/api.ts)
- Casino-specific helpers: [`src/casino/game/api.ts`](./src/casino/game/api.ts)

### Core API domains in `server.py`

- `/api/config`, `/api/site-shell`, `/api/me`
- `/api/wom/*`
- `/api/rewards`
- `/api/profile/wom-link` (`POST` link, `DELETE` unlink)
- `/api/casino/games`, `/api/casino/spin`
- `/api/giveaways`, `/api/giveaways/:id/enter`
- `/api/news`, `/api/news/:slug`
- `/api/admin/*`
- `/auth/*`

## 6. Design and UI Architecture

The current UI architecture is intentionally unified:

- **Single visual language** for both public and member surfaces
- **Centralized navigation config** in [`src/lib/navigation.ts`](./src/lib/navigation.ts)
- **Reusable surface primitives** (`AppContext`, `Panel`, `StatStrip`, `Highlight`, etc.)
- **Shared theme tokens** in `globals.css` (`--color-*`, `--font-*`, spacing/radius/shadow tokens)

This keeps app pages functional while making iterative visual edits fast.

## 7. Casino Architecture

- Main container: [`CasinoGame.tsx`](./src/components/app/CasinoGame.tsx)
- Renderer: [`SlotRenderer.ts`](./src/casino/game/renderers/SlotRenderer.ts)
- Assets: [`assets.ts`](./src/casino/game/assets.ts) + `src/casino/assets`
- Styling: [`src/casino/style.css`](./src/casino/style.css)

Key contract:

- API state lives in React component state.
- Pixi renderer owns canvas lifecycle and spin animation.
- Casino styling layers on top of global app styling for visual coherence.

## 8. Deployment Architecture (Current VPS Pattern)

Observed stack:

- Caddy serves `ghosted.smirkhub.com` and proxies to `127.0.0.1:3000`
- `ghosted-web.service` runs the standalone Next bundle from `/opt/ghosted/current-web`
- `ghosted-api.service` runs the remaining Python API from `/opt/ghosted/current-api`
- Environment/secrets come from `/etc/ghosted/ghosted.env`
- Releases are assembled under `/opt/ghosted/releases/<timestamp>-<sha>/` and activated through `current-web` / `current-api` symlinks

Typical deploy command:

1. `bash scripts/deploy-release.sh origin/main --auto`

The deploy script skips `npm ci` when `package-lock.json` is unchanged, always rebuilds the standalone web bundle, and restarts only the web or API service that changed.

## 9. Editing Guidance

### Where to edit

- New/changed page layout: `src/app/**/page.tsx`
- Shared app components: `src/components/app/AppUI.tsx`
- Navigation and route labels: `src/lib/navigation.ts`
- Theme and spacing: `src/app/globals.css`
- Casino behavior: `src/components/app/CasinoGame.tsx` + `src/casino/game/*`

### Principles

- Keep public and app surfaces in the same design system.
- Prefer shared primitives over per-page custom markup.
- Avoid inline styles; use reusable CSS classes and tokens.
- Keep API route strings aligned with `server.py` dispatch paths.
