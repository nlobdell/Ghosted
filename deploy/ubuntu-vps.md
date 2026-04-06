# Ghosted Ubuntu VPS Deployment

This guide reflects the current single-service architecture:

- Next.js web app on port `3000`
- Caddy as HTTPS reverse proxy
- SQLite and companion uploads on local disk

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y nodejs npm caddy
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

Use `/etc/ghosted/ghosted.env` for the Next.js runtime.

At minimum:

- `PORT=3000`
- `HOSTNAME=127.0.0.1`
- `PUBLIC_BASE_URL=https://your-domain.com`
- `DATABASE_PATH=/var/lib/ghosted/ghosted.db`
- `COMPANION_ASSET_DIR=/var/lib/ghosted/companion-assets`
- `SESSION_COOKIE_SECURE=true`
- `AUTH_SECRET=<long random secret>`
- `AUTH_URL=https://your-domain.com`
- `DISCORD_CLIENT_ID=<discord app client id>`
- `DISCORD_CLIENT_SECRET=<discord app client secret>`

Discord application settings must include this redirect URI for browser sign-in:

- `https://your-domain.com/api/auth/callback/discord`

## 5. Install the web service

Use [`deploy/ghosted-web.service`](./ghosted-web.service). The service runs the standalone Next bundle from `/opt/ghosted/current-web`.

Companion uploads should stay outside `/opt/ghosted`; the default runtime target is `/var/lib/ghosted/companion-assets` when `COMPANION_ASSET_DIR` is set as above.

Install the unit:

```bash
sudo cp /opt/ghosted/build/deploy/ghosted-web.service /etc/systemd/system/ghosted-web.service
sudo systemctl daemon-reload
sudo systemctl enable ghosted-web
```

## 6. Configure Caddy

Example:

```caddyfile
ghosted.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Do not point Caddy at any other backend process. The Next.js app now owns the public site, Auth.js routes, companion asset routes, and companion render routes directly.

## 7. Deploy updates

```bash
cd /opt/ghosted/build
sudo -u ghosted bash scripts/deploy-release.sh origin/main
```

Manual rollback:

```bash
cd /opt/ghosted/build
sudo -u ghosted bash scripts/deploy-release.sh rollback
```

## 8. Validate

```bash
sudo systemctl status ghosted-web --no-pager
curl -I https://your-domain.com
curl -I https://your-domain.com/api/config
curl -I https://your-domain.com/api/news
curl -I https://your-domain.com/api/giveaways
curl -I "https://your-domain.com/api/companion/render?preview=some-item"
curl -I "https://your-domain.com/auth/login?next=/hall/"
curl -I https://your-domain.com/api/auth/signin
```

If `/api/auth/signin` fails to render the Auth.js sign-in page, verify that `AUTH_SECRET`, `AUTH_URL`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` are all set for the web service and that the Discord app redirect URI exactly matches `https://your-domain.com/api/auth/callback/discord`.

## 9. Backups

Database path:

```text
/var/lib/ghosted/ghosted.db
```

Companion uploads path:

```text
/var/lib/ghosted/companion-assets
```

Add nightly copies and keep rotation in `/var/backups/ghosted`.
