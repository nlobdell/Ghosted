# Ghosted Ubuntu VPS Deployment

This guide reflects the current web app plus realtime sidecars:

- Next.js web app on port `3000`
- homepage scene realtime websocket service on port `3001`
- Discord worker as a separate Node process
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

## 3. Copy code to the live checkout

```bash
sudo rsync -av --delete ./ /opt/ghosted/
sudo chown -R ghosted:ghosted /opt/ghosted
```

The recommended production layout is now a single Git checkout at `/opt/ghosted`. The web service runs the standalone Next bundle directly from that checkout after every build.

## 4. Configure env file

Use `/etc/ghosted/ghosted.env` for the Next.js runtime, the scene realtime service, and the Discord worker.

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
- `DISCORD_GUILD_ID=<discord guild id>`
- `DISCORD_BOT_TOKEN=<discord bot token>`
- `SCENE_REALTIME_PORT=3001`

Discord application settings must include this redirect URI for browser sign-in:

- `https://your-domain.com/api/auth/callback/discord`

## 5. Install the services

Use [`deploy/ghosted-web.service`](./ghosted-web.service) for the web app, [`deploy/ghosted-scene-realtime.service`](./ghosted-scene-realtime.service) for the homepage websocket service, and [`deploy/ghosted-discord-worker.service`](./ghosted-discord-worker.service) for the Discord worker. The old `ghosted-discord-presence.service` file remains as a compatibility alias.

Companion uploads should stay outside `/opt/ghosted`; the default runtime target is `/var/lib/ghosted/companion-assets` when `COMPANION_ASSET_DIR` is set as above.

Install the units:

```bash
sudo cp /opt/ghosted/deploy/ghosted-web.service /etc/systemd/system/ghosted-web.service
sudo cp /opt/ghosted/deploy/ghosted-scene-realtime.service /etc/systemd/system/ghosted-scene-realtime.service
sudo cp /opt/ghosted/deploy/ghosted-discord-worker.service /etc/systemd/system/ghosted-discord-worker.service
sudo systemctl daemon-reload
sudo systemctl enable ghosted-web
sudo systemctl enable ghosted-scene-realtime
sudo systemctl enable ghosted-discord-worker
```

For the Discord developer-side application, bot, scopes, intents, and permission setup, follow [`discord-worker.md`](./discord-worker.md).

## 6. Configure Caddy

Example:

```caddyfile
ghosted.example.com {
    encode zstd gzip
    @sceneRealtime path /ws/scene/presence
    reverse_proxy @sceneRealtime 127.0.0.1:3001
    reverse_proxy 127.0.0.1:3000
}
```

The Next.js app still owns the public site, Auth.js routes, companion asset routes, and companion render routes directly. Only `/ws/scene/presence` should proxy to the scene realtime service; the Discord worker still only talks to Discord and SQLite.

## 7. Deploy updates

Current deploy workflow:

1. Push local changes to a feature branch.
2. Open a PR to `main`.
3. Merge the PR.
4. On the VPS:

```bash
cd /opt/ghosted
sudo git pull
sudo npm run build
sudo systemctl restart ghosted-web
```

If the deploy also changes the Discord worker, restart it separately:

```bash
sudo systemctl restart ghosted-discord-worker
```

If the deploy also changes the scene realtime service, restart it separately:

```bash
sudo systemctl restart ghosted-scene-realtime
```

`npm run build` prepares the standalone runtime bundle in place, including `.next/static`, `public`, and companion assets, so the web restart picks up the new build directly. The Discord worker runs from `scripts/discord-worker.mjs` inside the same checkout.

## 8. Validate

```bash
sudo systemctl status ghosted-web --no-pager
sudo systemctl status ghosted-scene-realtime --no-pager
sudo systemctl status ghosted-discord-worker --no-pager
curl --fail http://127.0.0.1:3000/api/config
curl --fail http://127.0.0.1:3001/health
curl -I https://your-domain.com
curl -I https://your-domain.com/api/config
curl -I https://your-domain.com/api/news
curl -I https://your-domain.com/api/giveaways
curl https://your-domain.com/api/scene/presence
curl -I "https://your-domain.com/api/companion/render?preview=some-item"
curl -I "https://your-domain.com/auth/login?next=/hall/"
curl -I https://your-domain.com/api/auth/signin
```

After the services are healthy, verify `/admin/discord-presence/` in the browser:

- worker health should match the service status
- current mode should read `Bot-backed matching` only when the worker heartbeat is healthy
- save at least one public voice/stage channel in the allowlist before expecting bot-backed homepage voice members

If `/api/auth/signin` fails to render the Auth.js sign-in page, verify that `AUTH_SECRET`, `AUTH_URL`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` are all set for the web service and that the Discord app redirect URI exactly matches `https://your-domain.com/api/auth/callback/discord`.

If the Discord worker fails to start, verify that `DISCORD_GUILD_ID` and `DISCORD_BOT_TOKEN` are present in `/etc/ghosted/ghosted.env`.

If the scene realtime service fails to start, verify that `SCENE_REALTIME_PORT` is not colliding with another local process and that `/ws/scene/presence` is proxied to `127.0.0.1:3001` in Caddy.

If a manual `npm run build` behaves differently on the server, make sure you loaded `/etc/ghosted/ghosted.env` first. Builds without that env file can fall back to `./data/ghosted.db` instead of `DATABASE_PATH=/var/lib/ghosted/ghosted.db`.

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
