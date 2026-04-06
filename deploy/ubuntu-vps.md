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

## 3. Copy code and prepare the build workspace

```bash
sudo mkdir -p /opt/ghosted/releases
sudo mkdir -p /opt/ghosted/.deploy-state
sudo rsync -av --delete ./ /opt/ghosted/build/
sudo chown -R ghosted:ghosted /opt/ghosted
```

## 4. Configure env file

Use `/etc/ghosted/ghosted.env` for both Next.js and Python settings and secrets.

At minimum:

- `HOST=127.0.0.1`
- `PORT=8000`
- `PUBLIC_BASE_URL=https://your-domain.com`
- `DATABASE_PATH=/var/lib/ghosted/ghosted.db`
- `COMPANION_ASSET_DIR=/var/lib/ghosted/companion-assets`
- `SESSION_COOKIE_SECURE=true`
- `PYTHON_API_URL=http://127.0.0.1:8000`
- `AUTH_SECRET=<long random secret>`
- `AUTH_URL=https://your-domain.com`
- `INTERNAL_API_SECRET=<shared secret used by Next and Python>`
- `DISCORD_CLIENT_ID=<discord app client id>`
- `DISCORD_CLIENT_SECRET=<discord app client secret>`

Discord application settings must include this redirect URI for browser sign-in:

- `https://your-domain.com/api/auth/callback/discord`

Only keep this legacy variable if you still invoke Python auth routes directly:

- `DISCORD_REDIRECT_URI=https://your-domain.com/auth/discord/callback`

## 5. Install services

### Next.js web service

Use [`deploy/ghosted-web.service`](./ghosted-web.service). The service runs the standalone Next bundle from `/opt/ghosted/current-web`.

### Python API service

Use [`deploy/ghosted-api.service`](./ghosted-api.service). The service runs `python3 /opt/ghosted/current-api/server.py`.

Companion uploads should stay outside `/opt/ghosted`; the default runtime target is `/var/lib/ghosted/companion-assets` when `COMPANION_ASSET_DIR` is set as above.

Install the units:

```bash
sudo cp /opt/ghosted/build/deploy/ghosted-web.service /etc/systemd/system/ghosted-web.service
sudo cp /opt/ghosted/build/deploy/ghosted-api.service /etc/systemd/system/ghosted-api.service
sudo systemctl daemon-reload
sudo systemctl enable ghosted-web ghosted-api
```

Your host can still keep a legacy `ghosted.service` alias if needed, but the release script and docs now assume:

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

Next.js now serves the core app APIs directly and still proxies the remaining unmigrated `/api/*` domains to the Python API using `PYTHON_API_URL` (default `http://localhost:8000`).
`/auth/login` and `/api/auth/*` stay inside Next/Auth.js.

Do not point Caddy at `127.0.0.1:8000` for the public site. That bypasses the Next.js auth layer and breaks Auth.js routes such as `/auth/login` and `/api/auth/*`.

## 7. Deploy updates

```bash
cd /opt/ghosted/build
sudo -u ghosted bash scripts/deploy-release.sh origin/main --auto
```

Manual rollback:

```bash
cd /opt/ghosted/build
sudo -u ghosted bash scripts/deploy-release.sh rollback --all
```

## 8. Validate

```bash
sudo systemctl status ghosted-web --no-pager
sudo systemctl status ghosted-api --no-pager
curl -I https://your-domain.com
curl -I https://your-domain.com/api/config
curl -I https://your-domain.com/api/news
curl -I https://your-domain.com/api/giveaways
curl -I https://your-domain.com/auth/login?next=/hall/
curl -I https://your-domain.com/api/auth/signin

If `/api/auth/signin` fails to render the Auth.js sign-in page, verify that `AUTH_SECRET`, `AUTH_URL`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` are all set for the Next.js service and that the Discord app redirect URI exactly matches `https://your-domain.com/api/auth/callback/discord`.
```

## 9. Backups

Database path:

```text
/var/lib/ghosted/ghosted.db
```

Add a nightly copy job and keep rotation in `/var/backups/ghosted`.
