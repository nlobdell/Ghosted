# Ghosted

Ghosted is a lightweight Python web app for the Ghosted Old School RuneScape community.

It combines:

- public marketing pages
- a Discord-authenticated member app
- Wise Old Man clan and competition data
- a points-based rewards and giveaway system
- an in-app casino backed by server-side state
- an admin console for operators

## Current Project Shape

The repo is organized around a single Python server and a mostly static frontend shell:

- `server.py` serves pages, APIs, auth flows, and SQLite-backed app data
- `index.html`, `styles.css`, and `site.js` power the public landing page and shared shell behavior
- `design/` contains the public About page
- `app/` contains the authenticated member experience
- `admin/` contains the operator console
- `src/casino/` contains the TypeScript/Pixi source for the casino runtime
- `app/casino/runtime/` contains the built browser assets used by the live casino page
- `data/ghosted.db` is the default local SQLite database

## Main Routes

Public pages:

- `/` landing page
- `/design/` about / system overview

Member app pages:

- `/app/` app hub
- `/app/community/` community overview
- `/app/clan/` clan detail
- `/app/competitions/` competition listing and drill-down
- `/app/rewards/` balance and ledger
- `/app/giveaways/` active giveaways
- `/app/profile/` Discord and Wise Old Man identity setup
- `/app/casino/` points-only casino experience

Admin page:

- `/admin/` operator console for rewards, giveaways, and data refresh actions

## API Surface

The Python server also exposes JSON endpoints used by the frontend shell:

- `/api/config`
- `/api/site-shell`
- `/api/me`
- `/api/wom/*`
- `/api/rewards`
- `/api/profile/wom-link`
- `/api/casino/games`
- `/api/casino/spin`
- `/api/giveaways`
- `/api/admin/*`

The app shell in `app/app.js` renders page-specific views on top of these endpoints.

## Local Development

Start the app with:

```powershell
python server.py
```

By default the app runs at:

```text
http://localhost:8000
```

## Authentication

Ghosted supports two auth modes.

Discord OAuth for real usage:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`

Optional Discord integration settings:

- `DISCORD_GUILD_ID`
- `DISCORD_BOT_TOKEN`
- `DISCORD_MEMBER_ROLE_ID`
- `DISCORD_VIP_ROLE_ID`
- `DISCORD_GIVEAWAY_ROLE_ID`
- `DISCORD_ROLE_LABELS_JSON`
- `DISCORD_WEBHOOK_URL`
- `DISCORD_USER_AGENT`
- `ADMIN_DISCORD_IDS`

Local development auth without Discord:

```powershell
$env:ENABLE_DEV_AUTH='1'
python server.py
```

Then open:

```text
http://localhost:8000/auth/dev-login?next=/app/
```

## Wise Old Man Integration

Wise Old Man powers the clan, player-linking, hiscores, gains, and competition views.

Relevant settings:

- `WOM_GROUP_ID`
- `WOM_API_BASE`
- `WOM_CACHE_TTL_SECONDS`

If `WOM_GROUP_ID` is not set, the app still runs, but clan and competition views fall back to disabled or empty states.

## Data and Runtime Settings

Important environment variables:

- `DATABASE_PATH`
- `PUBLIC_BASE_URL`
- `SESSION_COOKIE_SECURE`
- `ENABLE_DEV_AUTH`

Defaults:

- SQLite path defaults to `data/ghosted.db`
- Wise Old Man cache TTL defaults to 900 seconds
- session lifetime is 14 days

## Casino Development

The live casino page uses built assets from `app/casino/runtime/`, while the editable source lives in `src/casino/`.

Available scripts:

```powershell
npm run dev:casino
npm run build:casino
```

Use `build:casino` when you want to rebuild the runtime bundle from the TypeScript source.

## Tests

The repo includes backend tests in `tests/test_app.py`.

Run them with:

```powershell
python -m unittest
```

## Deployment

Deployment assets for the VPS setup live in `deploy/`:

- `deploy/ghosted.env.example`
- `deploy/ghosted.service`
- `deploy/Caddyfile.example`
- `deploy/ubuntu-vps.md`

The intended production stack is:

- Ubuntu VPS
- `systemd`
- Caddy
- SQLite on persistent disk

## Visual Editing

For the current browser-first editing workflow and a practical guide to learning HTML/CSS while changing the site, see [`VISUAL_EDITING_GUIDE.md`](./VISUAL_EDITING_GUIDE.md).

## Contributing

The repo uses a small-PR, rebase-first workflow. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the preferred branch and rebase routine.
