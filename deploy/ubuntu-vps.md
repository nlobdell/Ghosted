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

Using a dedicated checkout at `/opt/ghosted/build` is recommended, but not required. The release script can run from any Git checkout on the server. If your repo already lives at `/opt/ghosted`, you can run the script from there instead of creating `/opt/ghosted/build`.

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
- `DISCORD_REDIRECT_URI=https://your-domain.com/api/auth/callback/discord`

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

If your checkout lives at `/opt/ghosted` instead of `/opt/ghosted/build`, copy the unit from `/opt/ghosted/deploy/ghosted-web.service` instead.

If you want to run `scripts/deploy-release.sh` as the `ghosted` user, grant it passwordless access to inspect and restart just this service:

```bash
SYSTEMCTL_BIN="$(command -v systemctl)"
printf 'ghosted ALL=NOPASSWD:%s cat ghosted-web,%s restart ghosted-web,%s is-active ghosted-web\n' \
  "$SYSTEMCTL_BIN" "$SYSTEMCTL_BIN" "$SYSTEMCTL_BIN" \
  | sudo tee /etc/sudoers.d/ghosted-web >/dev/null
sudo chmod 440 /etc/sudoers.d/ghosted-web
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

From a dedicated build checkout:

```bash
cd /opt/ghosted/build
sudo -u ghosted -H bash -lc 'cd /opt/ghosted/build && bash ./scripts/deploy-release.sh origin/main'
```

From a repo that already lives at `/opt/ghosted`:

```bash
cd /opt/ghosted
sudo -u ghosted -H bash -lc 'cd /opt/ghosted && bash ./scripts/deploy-release.sh origin/main'
```

Manual rollback:

From a dedicated build checkout:

```bash
cd /opt/ghosted/build
sudo -u ghosted -H bash -lc 'cd /opt/ghosted/build && bash ./scripts/deploy-release.sh rollback'
```

From a repo that already lives at `/opt/ghosted`:

```bash
cd /opt/ghosted
sudo -u ghosted -H bash -lc 'cd /opt/ghosted && bash ./scripts/deploy-release.sh rollback'
```

The release script now:

- verifies that the installed `ghosted-web` service is the standalone `/opt/ghosted/current-web/server.js` unit
- rebuilds dependencies when `package-lock.json` changes or the Node runtime/ABI changes
- restarts the service and waits for `http://127.0.0.1:3000/api/config` to pass a health check
- automatically rolls back to the previous release if the new one fails to come up

## 8. Validate

```bash
sudo systemctl status ghosted-web --no-pager
curl --fail http://127.0.0.1:3000/api/config
curl -I https://your-domain.com
curl -I https://your-domain.com/api/config
curl -I https://your-domain.com/api/news
curl -I https://your-domain.com/api/giveaways
curl -I "https://your-domain.com/api/companion/render?preview=some-item"
curl -I "https://your-domain.com/auth/login?next=/hall/"
curl -I https://your-domain.com/api/auth/signin
```

If `/api/auth/signin` fails to render the Auth.js sign-in page, verify that `AUTH_SECRET`, `AUTH_URL`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` are all set for the web service and that the Discord app redirect URI exactly matches `https://your-domain.com/api/auth/callback/discord`.

If a manual `npm run build` behaves differently from the release script, make sure you loaded `/etc/ghosted/ghosted.env` first. Builds without that env file can fall back to `./data/ghosted.db` instead of `DATABASE_PATH=/var/lib/ghosted/ghosted.db`.

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
