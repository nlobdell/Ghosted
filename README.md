# Ghosted

Ghosted is now a lightweight Python web app with:

- Public marketing pages at `/` and `/design/`
- Discord-authenticated community apps at `/app/`
- Backend-owned rewards, casino, giveaway, and admin logic

## Run locally

```powershell
python server.py
```

The app starts on `http://localhost:8000` by default.

## Discord auth env vars

Set these for real Discord OAuth:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`

Optional Discord integrations:

- `DISCORD_GUILD_ID`
- `DISCORD_BOT_TOKEN`
- `DISCORD_MEMBER_ROLE_ID`
- `DISCORD_VIP_ROLE_ID`
- `DISCORD_GIVEAWAY_ROLE_ID`
- `DISCORD_WEBHOOK_URL`
- `ADMIN_DISCORD_IDS`
- `PUBLIC_BASE_URL`

## Dev auth

For local work without Discord credentials:

```powershell
$env:ENABLE_DEV_AUTH='1'
python server.py
```

Then sign in from the site, or visit:

```text
http://localhost:8000/auth/dev-login?next=/app/
```

## Notes

- Rewards are points-only and have no cash value.
- Balances, spins, and giveaway entries are validated on the backend.
- SQLite data is stored in `data/ghosted.db`.
