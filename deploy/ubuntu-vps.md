# Ghosted Ubuntu VPS Deployment

This guide reflects the current split architecture:

- Next.js web app (port `3000`)
- Python API service (port `8000`)
- Caddy as HTTPS reverse proxy

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y python3 python3-venv nodejs npm caddy
```

## 2. Create service account and directories

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin ghosted
sudo mkdir -p /opt/ghosted
sudo mkdir -p /etc/ghosted
sudo mkdir -p /var/lib/ghosted
sudo chown -R ghosted:ghosted /opt/ghosted
sudo chown -R ghosted:ghosted /var/lib/ghosted
```

## 3. Copy code and install dependencies

```bash
sudo rsync -av --delete ./ /opt/ghosted/
cd /opt/ghosted
sudo npm install
```

## 4. Configure env file

Use `/etc/ghosted/ghosted.env` for both Next.js and Python settings and secrets.

At minimum:

- `HOST=127.0.0.1`
- `PORT=8000`
- `PUBLIC_BASE_URL=https://your-domain.com`
- `DATABASE_PATH=/var/lib/ghosted/ghosted.db`
- `SESSION_COOKIE_SECURE=true`
- `PYTHON_API_URL=http://127.0.0.1:8000`
- `AUTH_SECRET=<long random secret>`
- `AUTH_URL=https://your-domain.com`
- `INTERNAL_API_SECRET=<shared secret used by Next and Python>`
- `DISCORD_CLIENT_ID=<discord app client id>`
- `DISCORD_CLIENT_SECRET=<discord app client secret>`

Discord application settings must include this redirect URI for browser sign-in:

- `https://your-domain.com/api/auth/callback/discord`

Legacy Python auth routes, if you still use them directly, can keep:

- `DISCORD_REDIRECT_URI=https://your-domain.com/auth/discord/callback`

## 5. Run services

### Next.js web service

Run `next start` on `127.0.0.1:3000` from `/opt/ghosted`.

### Python API service

Run `python3 /opt/ghosted/server.py` with environment from `/etc/ghosted/ghosted.env`.

Your host can use names like `ghosted-web.service` and `ghosted-api.service` (or legacy `ghosted.service`) as long as:

- web is reachable on `3000`
- API is reachable on `8000`

## 6. Configure Caddy

Example:

```caddyfile
ghosted.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Next.js handles `/api/*` and `/auth/*` rewrites to the Python API using `PYTHON_API_URL` (default `http://localhost:8000`).

Do not point Caddy at `127.0.0.1:8000` for the public site. That bypasses the Next.js auth layer and breaks Auth.js routes such as `/auth/login` and `/api/auth/*`.

## 7. Deploy updates

```bash
cd /opt/ghosted
git pull --ff-only origin main
npm install
npm run build
sudo systemctl restart ghosted-web
```

If backend logic changed:

```bash
sudo systemctl restart ghosted-api
```

(or restart your legacy Python service name if different)

## 8. Validate

```bash
sudo systemctl status ghosted-web --no-pager
sudo systemctl status ghosted-api --no-pager
curl -I https://your-domain.com
curl -I https://your-domain.com/api/config
curl -I https://your-domain.com/auth/login?next=/hall/
curl -I https://your-domain.com/api/auth/signin/discord
```

## 9. Backups

Database path:

```text
/var/lib/ghosted/ghosted.db
```

Add a nightly copy job and keep rotation in `/var/backups/ghosted`.
