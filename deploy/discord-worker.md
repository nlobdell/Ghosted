# Discord Worker Setup

This guide covers the Discord developer-side and runtime setup for the Ghosted Discord worker.

The worker is a generalized bot host. In this rollout it runs one active module:

- `voicePresence`

The host is responsible for:

- logging in with your Discord bot token
- keeping one shared Discord Gateway connection alive
- running registered Discord worker modules
- persisting worker health into SQLite for the web app and admin tooling

The active `voicePresence` module is responsible for:

- tracking live voice occupancy in the guild configured by `DISCORD_GUILD_ID`
- persisting active voice state into SQLite for the web app to consume
- allowing the site to fall back to widget-only presence when the bot is not installed or the worker is unhealthy

## 1. Create or reuse a Discord application

In the Discord Developer Portal:

1. Create a new application or open the existing Ghosted application.
2. Keep the existing OAuth browser sign-in configuration if you already use Discord login for the site.
3. Open the `Bot` section and create a bot user if the application does not already have one.

## 2. Enable the required bot settings

Under the application `Bot` page:

- enable `Server Members Intent`
- keep the bot token private
- regenerate the token only if you need to rotate it

The current worker host relies on:

- `GUILDS`
- `GUILD_VOICE_STATES`
- `GUILD_MEMBERS`

`Server Members Intent` is the privileged toggle that backs the member identity and display-name side of the current `voicePresence` module.

## 3. Generate the install URL

In `OAuth2` -> `URL Generator`:

- scopes:
  - `bot`
  - `applications.commands`

- bot permissions:
  - `View Channels`

Ghosted does not need message send, moderation, or voice-join permissions for this worker in v1.

## 4. Install the bot into the correct guild

Install the bot into the same guild whose ID is set in:

```text
DISCORD_GUILD_ID
```

If the bot is installed in a different guild, the worker will mark the configured guild as not installed and the site will stay on widget fallback.

## 5. Channel visibility rules

The worker can only track channels the bot can view.

For each voice or stage channel you want Ghosted to track:

- make sure the bot role can `View Channel`
- keep in mind that public homepage visibility is still controlled separately by Ghosted's channel allowlist

The worker may know about more channels than the public site shows. Public exposure is filtered in the app, not by broad bot permissions.

Healthy bot-backed presence only surfaces channels that Ghosted has allowlisted in the admin UI. If no public allowlist has been saved yet, the worker-backed path will not publish any voice members to the homepage scene. Widget fallback remains limited to what Discord's public widget exposes, and once an allowlist exists it is applied there too.

## 6. Runtime env configuration

Set these in the Ghosted runtime env file:

```text
DISCORD_GUILD_ID=<target guild id>
DISCORD_BOT_TOKEN=<bot token>
```

The web app and the worker both read the same env file at:

```text
/etc/ghosted/ghosted.env
```

## 7. Start and verify the worker

Local foreground run:

```bash
npm run discord:worker
```

Production service:

```bash
sudo systemctl restart ghosted-discord-worker
sudo systemctl status ghosted-discord-worker --no-pager
```

Healthy startup should:

- log in successfully
- report the active worker module set
- mark the configured guild as installed once the bot can sync it
- hydrate current voice occupancy into SQLite
- keep updating worker heartbeat and sync timestamps

## 8. Web and admin verification

After the worker starts, verify the public mode from both the admin page and the route payload:

1. Open `/admin/discord-presence/`.
2. Confirm the page shows the expected worker health and current public mode.
3. Save at least one voice or stage channel in the public allowlist before expecting bot-backed voice members on the homepage.
4. Query `/api/scene/presence` and inspect each member's `voiceSource`.

Expected checks:

- healthy worker:
  - admin page shows `Bot-backed matching`
  - `/api/scene/presence` returns linked voice members with `"voiceSource": "bot"`
- worker stale, errored, or not installed:
  - admin page shows `Widget fallback`
  - `/api/scene/presence` falls back to `"voiceSource": "widget"`
- allowlist filtering:
  - only selected voice/stage channels should produce public scene members
  - non-allowlisted bot-visible channels must stay absent from the homepage scene
- worker host startup:
  - service logs should show the logged-in bot identity and active module list
  - current rollout should report `voicePresence`

## 9. Common failure modes

- `DISCORD_GUILD_ID` or `DISCORD_BOT_TOKEN` missing:
  - worker stays idle and the site remains on widget fallback

- bot not installed in the configured guild:
  - worker marks the guild as not installed
  - public scene remains widget-only

- bot installed but cannot view the target channels:
  - those channels will not appear in worker-tracked voice state

- invalid or rotated bot token:
  - worker startup fails until the token is corrected and the service is restarted

- `Used disallowed intents`:
  - enable `Server Members Intent` on the Discord Developer Portal `Bot` page for this application
  - save the bot settings and restart the worker

## 10. Current v1 behavior boundaries

The worker host is reusable, but the current rollout only enables `voicePresence`.

It does not yet:

- send messages
- register slash command handlers
- join voice channels
- moderate members
- expose private channel occupancy publicly without the app allowlist
