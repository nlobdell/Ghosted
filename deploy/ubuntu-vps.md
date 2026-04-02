# Ghosted Ubuntu VPS Deployment

This guide assumes:

- Ubuntu 24.04 LTS
- A domain pointed at your server
- You want the app running continuously with `systemd`
- You want HTTPS handled by Caddy

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y python3 caddy
```

## 2. Create a service account and directories

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin ghosted
sudo mkdir -p /opt/ghosted
sudo mkdir -p /etc/ghosted
sudo mkdir -p /var/lib/ghosted
sudo chown -R ghosted:ghosted /opt/ghosted
sudo chown -R ghosted:ghosted /var/lib/ghosted
```

## 3. Copy the app to the server

```bash
sudo rsync -av --delete ./ /opt/ghosted/
sudo chown -R ghosted:ghosted /opt/ghosted
```

## 4. Create the production env file

Start from `deploy/ghosted.env.example` and place the real version at:

```text
/etc/ghosted/ghosted.env
```

Recommended production values:

- `HOST=127.0.0.1`
- `PORT=8000`
- `DATABASE_PATH=/var/lib/ghosted/ghosted.db`
- `PUBLIC_BASE_URL=https://your-domain.com`
- `SESSION_COOKIE_SECURE=true`
- `DISCORD_REDIRECT_URI=https://your-domain.com/auth/discord/callback`

## 5. Register the Discord callback URL

In the Discord Developer Portal, add the exact redirect URI:

```text
https://your-domain.com/auth/discord/callback
```

This must match the production env value exactly.

## 6. Install the systemd service

```bash
sudo cp /opt/ghosted/deploy/ghosted.service /etc/systemd/system/ghosted.service
sudo systemctl daemon-reload
sudo systemctl enable --now ghosted
sudo systemctl status ghosted
```

Useful commands:

```bash
sudo journalctl -u ghosted -f
sudo systemctl restart ghosted
```

## 7. Configure Caddy

Copy `deploy/Caddyfile.example` into `/etc/caddy/Caddyfile` and replace the domain.

```bash
sudo cp /opt/ghosted/deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will automatically provision HTTPS once DNS is pointed correctly.

## 8. Back up the database

The production database lives at:

```text
/var/lib/ghosted/ghosted.db
```

At minimum, add a nightly backup job, for example:

```bash
sudo mkdir -p /var/backups/ghosted
sudo crontab -e
```

Example cron entry:

```cron
0 3 * * * cp /var/lib/ghosted/ghosted.db /var/backups/ghosted/ghosted-$(date +\%F).db
```

## 9. Deploy updates

```bash
git pull --ff-only origin main
npm run build:casino
sudo systemctl restart ghosted
```

## Notes

- This app currently uses SQLite, so run a single app instance.
- Keep the database on persistent local disk.
- If traffic grows substantially, the next step is moving to Postgres before scaling horizontally.
