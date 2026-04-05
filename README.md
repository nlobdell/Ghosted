# Ghosted

Ghosted is a community platform for the Ghosted Old School RuneScape clan, built as:

- a **Next.js frontend** (`src/app`)
- a **Python API/backend** (`server.py`)
- a **SQLite data layer** for rewards, giveaways, casino history, and news publishing

The canonical architecture reference is [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech Stack

- Next.js 16, React 19, TypeScript
- Python 3 (`http.server` + SQLite)
- Pixi.js for the casino renderer
- Caddy + systemd for VPS hosting

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

## Scripts

- `npm run dev` - start Next.js in development mode
- `npm run build` - production build
- `npm run start` - run built Next.js app
- `npm run lint` - run lint checks
- `npm run git:update` - local workflow helper script

## Production Notes

Current VPS pattern:

- Caddy -> Next.js (`ghosted-web.service`) on `127.0.0.1:3000`
- Next rewrites `/api/*` and `/auth/*` to Python API (`PYTHON_API_URL`, usually `127.0.0.1:8000`)
- Env file at `/etc/ghosted/ghosted.env`

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
