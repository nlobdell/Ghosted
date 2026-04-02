from __future__ import annotations

import json
import mimetypes
import os
import random
import re
import secrets
import sqlite3
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "data"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DB_DIR / "ghosted.db"))).expanduser()
SESSION_COOKIE = "ghosted_session"
SESSION_LIFETIME_DAYS = 14
STARTING_BALANCE = 250
MEMBER_ROLE_BONUS = 100
DAILY_WAGER_CAP = 500
SPIN_COOLDOWN_SECONDS = 2
REQUEST_TIMEOUT = 10
RNG = random.SystemRandom()
STATIC_MIME_OVERRIDES = {
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}


class AppError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass
class AuthConfig:
    client_id: str | None
    client_secret: str | None
    redirect_uri: str | None
    guild_id: str | None
    bot_token: str | None
    member_role_id: str | None
    vip_role_id: str | None
    giveaway_role_id: str | None
    webhook_url: str | None

    @property
    def oauth_ready(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)

    @property
    def guild_ready(self) -> bool:
        return bool(self.guild_id and self.bot_token)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_iso(value: datetime | None = None) -> str:
    return (value or utc_now()).isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "item"


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def session_cookie_header(token: str | None = None, *, delete: bool = False) -> str:
    secure = env_flag("SESSION_COOKIE_SECURE", False)
    max_age = 0 if delete else SESSION_LIFETIME_DAYS * 86400
    value = "deleted" if delete else token
    parts = [
        f"{SESSION_COOKIE}={value}",
        "Path=/",
        "HttpOnly",
        f"Max-Age={max_age}",
        "SameSite=Lax",
    ]
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def admin_discord_ids() -> set[str]:
    raw = os.getenv("ADMIN_DISCORD_IDS", "")
    return {item.strip() for item in raw.split(",") if item.strip()}


def build_auth_config(base_url: str | None = None) -> AuthConfig:
    redirect_uri = os.getenv("DISCORD_REDIRECT_URI")
    if not redirect_uri and base_url:
        redirect_uri = f"{base_url}/auth/discord/callback"
    return AuthConfig(
        client_id=os.getenv("DISCORD_CLIENT_ID"),
        client_secret=os.getenv("DISCORD_CLIENT_SECRET"),
        redirect_uri=redirect_uri,
        guild_id=os.getenv("DISCORD_GUILD_ID"),
        bot_token=os.getenv("DISCORD_BOT_TOKEN"),
        member_role_id=os.getenv("DISCORD_MEMBER_ROLE_ID"),
        vip_role_id=os.getenv("DISCORD_VIP_ROLE_ID"),
        giveaway_role_id=os.getenv("DISCORD_GIVEAWAY_ROLE_ID"),
        webhook_url=os.getenv("DISCORD_WEBHOOK_URL"),
    )


def connect_database(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL,
            global_name TEXT,
            avatar_hash TEXT,
            roles_json TEXT NOT NULL DEFAULT '[]',
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_states (
            state TEXT PRIMARY KEY,
            next_path TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reward_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount INTEGER NOT NULL,
            entry_type TEXT NOT NULL,
            description TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS casino_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            cost INTEGER NOT NULL,
            config_json TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS casino_spins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_id INTEGER NOT NULL REFERENCES casino_games(id),
            wager INTEGER NOT NULL,
            payout INTEGER NOT NULL,
            symbols_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS giveaways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            start_at TEXT NOT NULL,
            end_at TEXT NOT NULL,
            point_cost INTEGER NOT NULL DEFAULT 0,
            max_entries INTEGER NOT NULL DEFAULT 1,
            required_role_id TEXT,
            status TEXT NOT NULL,
            winner_user_id INTEGER REFERENCES users(id),
            created_by_user_id INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS giveaway_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_user_id INTEGER REFERENCES users(id),
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            payload_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        );
        """
    )
    seed_default_games(connection)
    seed_default_giveaway(connection)
    connection.commit()


def seed_default_games(connection: sqlite3.Connection) -> None:
    existing = connection.execute("SELECT COUNT(*) AS count FROM casino_games").fetchone()["count"]
    if existing:
        return

    games = [
        {
            "slug": "moon-spark",
            "name": "Moon Spark",
            "cost": 10,
            "config": {
                "reel_symbols": ["moon", "moon", "rune", "coin", "coin", "ghost"],
                "triple": {"moon": 6, "ghost": 5, "rune": 4, "coin": 3},
                "double": {"moon": 2, "ghost": 2},
                "top_payout": 60,
                "flavor": "Light stakes, quick spins, decent chances to keep your streak alive.",
            },
        },
        {
            "slug": "shadow-vault",
            "name": "Shadow Vault",
            "cost": 25,
            "config": {
                "reel_symbols": ["crown", "ghost", "rune", "coin", "coin", "moon"],
                "triple": {"crown": 10, "ghost": 7, "rune": 5, "moon": 4},
                "double": {"crown": 2, "ghost": 2, "rune": 1},
                "top_payout": 250,
                "flavor": "A balanced machine for players who want bigger swings without going all-in.",
            },
        },
        {
            "slug": "phantom-jackpot",
            "name": "Phantom Jackpot",
            "cost": 50,
            "config": {
                "reel_symbols": ["crown", "crown", "ghost", "rune", "moon", "coin"],
                "triple": {"crown": 16, "ghost": 10, "rune": 7, "moon": 5},
                "double": {"crown": 3, "ghost": 2, "rune": 1},
                "top_payout": 800,
                "flavor": "Higher risk, higher reward, and the machine everyone blames when it runs cold.",
            },
        },
    ]

    created_at = utc_iso()
    for game in games:
        connection.execute(
            """
            INSERT INTO casino_games (slug, name, cost, config_json, active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (game["slug"], game["name"], game["cost"], json.dumps(game["config"]), created_at),
        )


def seed_default_giveaway(connection: sqlite3.Connection) -> None:
    existing = connection.execute("SELECT COUNT(*) AS count FROM giveaways").fetchone()["count"]
    if existing:
        return

    now = utc_now()
    title = "Ghosted Starter Supply Drop"
    connection.execute(
        """
        INSERT INTO giveaways (
            slug, title, description, start_at, end_at, point_cost, max_entries,
            required_role_id, status, winner_user_id, created_by_user_id, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'active', NULL, NULL, ?)
        """,
        (
            slugify(title),
            title,
            "A sample launch giveaway for clan cosmetics, event spots, or Discord shout-outs.",
            utc_iso(now - timedelta(days=1)),
            utc_iso(now + timedelta(days=10)),
            25,
            3,
            utc_iso(now),
        ),
    )


def prune_expired_sessions(connection: sqlite3.Connection) -> None:
    connection.execute("DELETE FROM sessions WHERE expires_at < ?", (utc_iso(),))
    connection.execute("DELETE FROM auth_states WHERE created_at < ?", (utc_iso(utc_now() - timedelta(hours=1)),))
    connection.commit()


def append_ledger(
    connection: sqlite3.Connection,
    user_id: int,
    amount: int,
    entry_type: str,
    description: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO reward_ledger (user_id, amount, entry_type, description, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, amount, entry_type, description, json.dumps(metadata or {}), utc_iso()),
    )


def audit(
    connection: sqlite3.Connection,
    actor_user_id: int | None,
    action: str,
    target_type: str,
    target_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO audit_log (actor_user_id, action, target_type, target_id, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (actor_user_id, action, target_type, target_id, json.dumps(payload or {}), utc_iso()),
    )


def get_balance(connection: sqlite3.Connection, user_id: int) -> int:
    row = connection.execute(
        "SELECT COALESCE(SUM(amount), 0) AS balance FROM reward_ledger WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return int(row["balance"])


def get_user(connection: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def get_user_by_discord_id(connection: sqlite3.Connection, discord_id: str) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM users WHERE discord_id = ?", (discord_id,)).fetchone()


def user_roles(row: sqlite3.Row | None) -> list[str]:
    if not row:
        return []
    return json_loads(row["roles_json"], [])


def display_name(row: sqlite3.Row) -> str:
    return row["global_name"] or row["username"]


def avatar_url(row: sqlite3.Row) -> str | None:
    if not row["avatar_hash"]:
        return None
    return f"https://cdn.discordapp.com/avatars/{row['discord_id']}/{row['avatar_hash']}.png?size=128"


def create_or_update_user(
    connection: sqlite3.Connection,
    discord_user: dict[str, Any],
    roles: list[str] | None = None,
) -> sqlite3.Row:
    roles = roles or []
    discord_id = str(discord_user["id"])
    now = utc_iso()
    is_admin = 1 if discord_id in admin_discord_ids() else 0
    connection.execute(
        """
        INSERT INTO users (discord_id, username, global_name, avatar_hash, roles_json, is_admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
            username = excluded.username,
            global_name = excluded.global_name,
            avatar_hash = excluded.avatar_hash,
            roles_json = excluded.roles_json,
            is_admin = excluded.is_admin,
            updated_at = excluded.updated_at
        """,
        (
            discord_id,
            discord_user.get("username", "ghosted-member"),
            discord_user.get("global_name"),
            discord_user.get("avatar"),
            json.dumps(roles),
            is_admin,
            now,
            now,
        ),
    )
    return get_user_by_discord_id(connection, discord_id)


def ensure_user_rewards(
    connection: sqlite3.Connection,
    row: sqlite3.Row,
    auth_config: AuthConfig,
) -> None:
    existing_welcome = connection.execute(
        "SELECT 1 FROM reward_ledger WHERE user_id = ? AND entry_type = 'welcome_bonus' LIMIT 1",
        (row["id"],),
    ).fetchone()
    if not existing_welcome:
        append_ledger(
            connection,
            row["id"],
            STARTING_BALANCE,
            "welcome_bonus",
            "Welcome bonus for linking your Discord account.",
            {"source": "discord_auth"},
        )

    eligible_for_role_bonus = auth_config.member_role_id and auth_config.member_role_id in user_roles(row)
    if eligible_for_role_bonus:
        existing_role_bonus = connection.execute(
            "SELECT 1 FROM reward_ledger WHERE user_id = ? AND entry_type = 'role_bonus' LIMIT 1",
            (row["id"],),
        ).fetchone()
        if not existing_role_bonus:
            append_ledger(
                connection,
                row["id"],
                MEMBER_ROLE_BONUS,
                "role_bonus",
                "Member role bonus for verified Ghosted members.",
                {"role_id": auth_config.member_role_id},
            )


def create_session(connection: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    connection.execute(
        """
        INSERT INTO sessions (token, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (token, user_id, utc_iso(utc_now() + timedelta(days=SESSION_LIFETIME_DAYS)), utc_iso()),
    )
    connection.commit()
    return token


def destroy_session(connection: sqlite3.Connection, token: str | None) -> None:
    if not token:
        return
    connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
    connection.commit()


def create_auth_state(connection: sqlite3.Connection, next_path: str) -> str:
    state = secrets.token_urlsafe(24)
    connection.execute(
        "INSERT INTO auth_states (state, next_path, created_at) VALUES (?, ?, ?)",
        (state, next_path, utc_iso()),
    )
    connection.commit()
    return state


def consume_auth_state(connection: sqlite3.Connection, state: str) -> str | None:
    row = connection.execute("SELECT next_path FROM auth_states WHERE state = ?", (state,)).fetchone()
    connection.execute("DELETE FROM auth_states WHERE state = ?", (state,))
    connection.commit()
    return row["next_path"] if row else None


def fetch_discord_token(code: str, auth_config: AuthConfig) -> dict[str, Any]:
    if not auth_config.oauth_ready:
        raise AppError("Discord auth is not configured yet.", 503)

    payload = urlencode(
        {
            "client_id": auth_config.client_id,
            "client_secret": auth_config.client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": auth_config.redirect_uri,
        }
    ).encode("utf-8")
    request = Request(
        "https://discord.com/api/oauth2/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise AppError(f"Discord token exchange failed: HTTP {exc.code}: {body}", 502) from exc
    except URLError as exc:
        raise AppError(f"Discord token exchange failed: {exc}", 502) from exc


def fetch_discord_identity(access_token: str) -> dict[str, Any]:
    request = Request(
        "https://discord.com/api/users/@me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        raise AppError(f"Discord user lookup failed: {exc}", 502) from exc


def fetch_discord_roles(discord_id: str, auth_config: AuthConfig) -> list[str]:
    if not auth_config.guild_ready:
        return []
    request = Request(
        f"https://discord.com/api/guilds/{auth_config.guild_id}/members/{discord_id}",
        headers={"Authorization": f"Bot {auth_config.bot_token}"},
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return [str(role) for role in payload.get("roles", [])]
    except HTTPError as exc:
        if exc.code == 404:
            return []
        raise AppError(f"Discord role sync failed: {exc}", 502) from exc
    except URLError as exc:
        raise AppError(f"Discord role sync failed: {exc}", 502) from exc


def post_webhook(content: str, auth_config: AuthConfig) -> None:
    if not auth_config.webhook_url:
        return
    payload = json.dumps({"content": content}).encode("utf-8")
    request = Request(
        auth_config.webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT):
            return
    except (HTTPError, URLError):
        return


def list_games(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = connection.execute(
        "SELECT * FROM casino_games WHERE active = 1 ORDER BY cost ASC, id ASC"
    ).fetchall()
    games: list[dict[str, Any]] = []
    for row in rows:
        config = json_loads(row["config_json"], {})
        games.append(
            {
                "id": row["id"],
                "slug": row["slug"],
                "name": row["name"],
                "cost": row["cost"],
                "topPayout": config.get("top_payout", row["cost"]),
                "flavor": config.get("flavor", ""),
                "reelSymbols": config.get("reel_symbols", []),
            }
        )
    return games


def evaluate_spin(game_row: sqlite3.Row, rng: random.Random | random.SystemRandom | None = None) -> tuple[list[str], int]:
    rng = rng or RNG
    config = json_loads(game_row["config_json"], {})
    symbols = [rng.choice(config["reel_symbols"]) for _ in range(3)]
    counts = Counter(symbols)
    payout = 0

    if len(counts) == 1:
        symbol = symbols[0]
        payout = int(game_row["cost"] * config.get("triple", {}).get(symbol, 0))
    else:
        repeated = next((symbol for symbol, count in counts.items() if count == 2), None)
        if repeated:
            payout = int(game_row["cost"] * config.get("double", {}).get(repeated, 0))

    return symbols, payout


def total_wagered_today(connection: sqlite3.Connection, user_id: int) -> int:
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    row = connection.execute(
        """
        SELECT COALESCE(SUM(wager), 0) AS total
        FROM casino_spins
        WHERE user_id = ? AND created_at >= ?
        """,
        (user_id, utc_iso(start)),
    ).fetchone()
    return int(row["total"])


def last_spin_time(connection: sqlite3.Connection, user_id: int) -> datetime | None:
    row = connection.execute(
        "SELECT created_at FROM casino_spins WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    return parse_iso(row["created_at"]) if row else None


def spin_game(
    connection: sqlite3.Connection,
    user_row: sqlite3.Row,
    game_slug: str,
    rng: random.Random | random.SystemRandom | None = None,
) -> dict[str, Any]:
    game_row = connection.execute(
        "SELECT * FROM casino_games WHERE slug = ? AND active = 1",
        (game_slug,),
    ).fetchone()
    if not game_row:
        raise AppError("That machine does not exist.", 404)

    balance = get_balance(connection, user_row["id"])
    if balance < game_row["cost"]:
        raise AppError("You do not have enough points for that spin.", 400)

    if total_wagered_today(connection, user_row["id"]) + game_row["cost"] > DAILY_WAGER_CAP:
        raise AppError("You have reached the daily wager cap. Try again tomorrow.", 429)

    previous_spin = last_spin_time(connection, user_row["id"])
    if previous_spin and (utc_now() - previous_spin).total_seconds() < SPIN_COOLDOWN_SECONDS:
        raise AppError("Slow down a little between spins.", 429)

    append_ledger(
        connection,
        user_row["id"],
        -game_row["cost"],
        "casino_wager",
        f"Wagered on {game_row['name']}.",
        {"game_slug": game_slug, "cost": game_row["cost"]},
    )
    symbols, payout = evaluate_spin(game_row, rng=rng)
    connection.execute(
        """
        INSERT INTO casino_spins (user_id, game_id, wager, payout, symbols_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_row["id"], game_row["id"], game_row["cost"], payout, json.dumps(symbols), utc_iso()),
    )
    if payout:
        append_ledger(
            connection,
            user_row["id"],
            payout,
            "casino_payout",
            f"Hit a payout on {game_row['name']}.",
            {"game_slug": game_slug, "symbols": symbols, "payout": payout},
        )
    connection.commit()

    return {
        "game": game_row["name"],
        "symbols": symbols,
        "wager": game_row["cost"],
        "payout": payout,
        "net": payout - game_row["cost"],
        "balance": get_balance(connection, user_row["id"]),
    }


def giveaway_status(row: sqlite3.Row) -> str:
    if row["status"] == "completed":
        return "completed"
    now = utc_now()
    start = parse_iso(row["start_at"])
    end = parse_iso(row["end_at"])
    if start and now < start:
        return "scheduled"
    if end and now > end:
        return "ended"
    return row["status"]


def list_giveaways(connection: sqlite3.Connection, user_row: sqlite3.Row | None = None) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            giveaways.*,
            COALESCE(entry_counts.total_entries, 0) AS total_entries,
            COALESCE(user_entries.user_entries, 0) AS user_entries
        FROM giveaways
        LEFT JOIN (
            SELECT giveaway_id, COUNT(*) AS total_entries
            FROM giveaway_entries
            GROUP BY giveaway_id
        ) AS entry_counts ON entry_counts.giveaway_id = giveaways.id
        LEFT JOIN (
            SELECT giveaway_id, COUNT(*) AS user_entries
            FROM giveaway_entries
            WHERE user_id = ?
            GROUP BY giveaway_id
        ) AS user_entries ON user_entries.giveaway_id = giveaways.id
        ORDER BY end_at ASC, id ASC
        """,
        (user_row["id"] if user_row else -1,),
    ).fetchall()

    giveaways = []
    roles = set(user_roles(user_row))
    balance = get_balance(connection, user_row["id"]) if user_row else 0
    for row in rows:
        status = giveaway_status(row)
        required_role = row["required_role_id"]
        role_ok = not required_role or required_role in roles
        max_entries = row["max_entries"]
        user_entry_count = int(row["user_entries"])
        can_enter = (
            bool(user_row)
            and status == "active"
            and role_ok
            and user_entry_count < max_entries
            and balance >= row["point_cost"]
        )

        giveaways.append(
            {
                "id": row["id"],
                "slug": row["slug"],
                "title": row["title"],
                "description": row["description"],
                "startAt": row["start_at"],
                "endAt": row["end_at"],
                "pointCost": row["point_cost"],
                "maxEntries": max_entries,
                "userEntries": user_entry_count,
                "totalEntries": int(row["total_entries"]),
                "requiredRoleId": required_role,
                "status": status,
                "winnerUserId": row["winner_user_id"],
                "canEnter": can_enter,
                "eligibility": {
                    "authenticated": bool(user_row),
                    "roleOk": role_ok,
                    "enoughPoints": balance >= row["point_cost"],
                    "remainingEntries": max_entries - user_entry_count,
                },
            }
        )
    return giveaways


def enter_giveaway(connection: sqlite3.Connection, user_row: sqlite3.Row, giveaway_id: int) -> dict[str, Any]:
    giveaway = connection.execute("SELECT * FROM giveaways WHERE id = ?", (giveaway_id,)).fetchone()
    if not giveaway:
        raise AppError("That giveaway does not exist.", 404)

    status = giveaway_status(giveaway)
    if status != "active":
        raise AppError("That giveaway is not currently accepting entries.", 400)

    roles = set(user_roles(user_row))
    if giveaway["required_role_id"] and giveaway["required_role_id"] not in roles:
        raise AppError("Your Discord roles do not qualify for this giveaway.", 403)

    existing_entries = connection.execute(
        "SELECT COUNT(*) AS count FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?",
        (giveaway_id, user_row["id"]),
    ).fetchone()["count"]
    if existing_entries >= giveaway["max_entries"]:
        raise AppError("You have already used all of your entries for this giveaway.", 400)

    balance = get_balance(connection, user_row["id"])
    if balance < giveaway["point_cost"]:
        raise AppError("You do not have enough points for another entry.", 400)

    if giveaway["point_cost"] > 0:
        append_ledger(
            connection,
            user_row["id"],
            -giveaway["point_cost"],
            "giveaway_entry",
            f"Entered giveaway: {giveaway['title']}.",
            {"giveaway_id": giveaway_id, "cost": giveaway["point_cost"]},
        )

    connection.execute(
        "INSERT INTO giveaway_entries (giveaway_id, user_id, created_at) VALUES (?, ?, ?)",
        (giveaway_id, user_row["id"], utc_iso()),
    )
    connection.commit()

    return {
        "giveawayId": giveaway_id,
        "title": giveaway["title"],
        "entriesUsed": existing_entries + 1,
        "entriesRemaining": giveaway["max_entries"] - existing_entries - 1,
        "balance": get_balance(connection, user_row["id"]),
    }


def recent_ledger(connection: sqlite3.Connection, user_id: int, limit: int = 25) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT id, amount, entry_type, description, metadata_json, created_at
        FROM reward_ledger
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "amount": row["amount"],
            "entryType": row["entry_type"],
            "description": row["description"],
            "metadata": json_loads(row["metadata_json"], {}),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def recent_spins(connection: sqlite3.Connection, user_id: int, limit: int = 5) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT casino_spins.*, casino_games.name
        FROM casino_spins
        JOIN casino_games ON casino_games.id = casino_spins.game_id
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "game": row["name"],
            "wager": row["wager"],
            "payout": row["payout"],
            "symbols": json_loads(row["symbols_json"], []),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def profile_payload(connection: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    roles = user_roles(row)
    perks = []
    auth_config = build_auth_config()
    if auth_config.member_role_id and auth_config.member_role_id in roles:
        perks.append("Verified Ghosted member")
    if auth_config.vip_role_id and auth_config.vip_role_id in roles:
        perks.append("VIP reward perks")
    if row["is_admin"]:
        perks.append("Admin controls enabled")

    entries = connection.execute(
        "SELECT COUNT(*) AS count FROM giveaway_entries WHERE user_id = ?",
        (row["id"],),
    ).fetchone()["count"]
    return {
        "id": row["id"],
        "discordId": row["discord_id"],
        "displayName": display_name(row),
        "username": row["username"],
        "avatarUrl": avatar_url(row),
        "roles": roles,
        "perks": perks,
        "isAdmin": bool(row["is_admin"]),
        "balance": get_balance(connection, row["id"]),
        "giveawayEntries": int(entries),
        "recentSpins": recent_spins(connection, row["id"], limit=3),
    }


def create_giveaway(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    payload: dict[str, Any],
    auth_config: AuthConfig,
) -> dict[str, Any]:
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    start_at = str(payload.get("startAt", "")).strip()
    end_at = str(payload.get("endAt", "")).strip()
    point_cost = int(payload.get("pointCost", 0))
    max_entries = int(payload.get("maxEntries", 1))
    required_role_id = str(payload.get("requiredRoleId", "")).strip() or None
    if not title or not description or not start_at or not end_at:
        raise AppError("Title, description, start, and end are required.")

    start = parse_iso(start_at)
    end = parse_iso(end_at)
    if not start or not end or end <= start:
        raise AppError("Giveaway timing is invalid.")
    if point_cost < 0 or max_entries < 1:
        raise AppError("Giveaway cost and max entries must be positive.")

    slug = f"{slugify(title)}-{int(utc_now().timestamp())}"
    status = "active" if start <= utc_now() <= end else "scheduled"
    connection.execute(
        """
        INSERT INTO giveaways (
            slug, title, description, start_at, end_at, point_cost, max_entries,
            required_role_id, status, winner_user_id, created_by_user_id, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        """,
        (
            slug,
            title,
            description,
            start_at,
            end_at,
            point_cost,
            max_entries,
            required_role_id,
            status,
            actor_row["id"],
            utc_iso(),
        ),
    )
    giveaway_id = int(connection.execute("SELECT last_insert_rowid()").fetchone()[0])
    audit(connection, actor_row["id"], "create_giveaway", "giveaway", str(giveaway_id), payload)
    connection.commit()
    post_webhook(f"New Ghosted giveaway launched: **{title}**", auth_config)
    return {"id": giveaway_id, "title": title, "status": status}


def draw_giveaway_winner(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    giveaway_id: int,
    auth_config: AuthConfig,
    rng: random.Random | random.SystemRandom | None = None,
) -> dict[str, Any]:
    giveaway = connection.execute("SELECT * FROM giveaways WHERE id = ?", (giveaway_id,)).fetchone()
    if not giveaway:
        raise AppError("Giveaway not found.", 404)
    if giveaway["winner_user_id"]:
        raise AppError("This giveaway already has a winner.", 400)
    status = giveaway_status(giveaway)
    if status == "scheduled":
        raise AppError("You cannot draw a giveaway before it starts.", 400)
    if status == "active":
        raise AppError("Wait until the giveaway has ended before drawing a winner.", 400)

    entries = connection.execute(
        "SELECT * FROM giveaway_entries WHERE giveaway_id = ? ORDER BY id ASC",
        (giveaway_id,),
    ).fetchall()
    if not entries:
        raise AppError("There are no entries to draw from.", 400)

    chosen = (rng or RNG).choice(entries)
    connection.execute(
        "UPDATE giveaways SET winner_user_id = ?, status = 'completed' WHERE id = ?",
        (chosen["user_id"], giveaway_id),
    )
    winner_row = get_user(connection, chosen["user_id"])
    audit(
        connection,
        actor_row["id"],
        "draw_giveaway",
        "giveaway",
        str(giveaway_id),
        {"winner_user_id": chosen["user_id"]},
    )
    connection.commit()
    if winner_row:
        post_webhook(
            f"Giveaway winner: **{display_name(winner_row)}** won **{giveaway['title']}**.",
            auth_config,
        )
    return {
        "giveawayId": giveaway_id,
        "title": giveaway["title"],
        "winner": display_name(winner_row) if winner_row else "Unknown user",
    }


def grant_points(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    payload: dict[str, Any],
) -> dict[str, Any]:
    amount = int(payload.get("amount", 0))
    description = str(payload.get("description", "")).strip()
    user_id = payload.get("userId")
    discord_id = str(payload.get("discordId", "")).strip()
    if amount == 0 or not description:
        raise AppError("Grant amount and description are required.")

    target = None
    if user_id:
        target = get_user(connection, int(user_id))
    elif discord_id:
        target = get_user_by_discord_id(connection, discord_id)
    if not target:
        raise AppError("Could not find that user.", 404)

    append_ledger(
        connection,
        target["id"],
        amount,
        "admin_grant",
        description,
        {"actor_user_id": actor_row["id"]},
    )
    audit(
        connection,
        actor_row["id"],
        "grant_points",
        "user",
        str(target["id"]),
        {"amount": amount, "description": description},
    )
    connection.commit()
    return {"userId": target["id"], "balance": get_balance(connection, target["id"])}


def admin_overview(connection: sqlite3.Connection) -> dict[str, Any]:
    users = connection.execute(
        """
        SELECT
            users.id,
            users.discord_id,
            users.username,
            users.global_name,
            users.is_admin,
            COALESCE(SUM(reward_ledger.amount), 0) AS balance
        FROM users
        LEFT JOIN reward_ledger ON reward_ledger.user_id = users.id
        GROUP BY users.id
        ORDER BY balance DESC, users.id ASC
        LIMIT 20
        """
    ).fetchall()
    return {
        "users": [
            {
                "id": row["id"],
                "discordId": row["discord_id"],
                "displayName": row["global_name"] or row["username"],
                "balance": int(row["balance"]),
                "isAdmin": bool(row["is_admin"]),
            }
            for row in users
        ],
        "giveaways": list_giveaways(connection),
    }


class GhostedHandler(BaseHTTPRequestHandler):
    server_version = "GhostedApp/0.1"

    def do_GET(self) -> None:
        connection = connect_database()
        try:
            prune_expired_sessions(connection)
            self.route_request("GET", connection)
        except AppError as exc:
            self.respond_error(exc.status, exc.message)
        finally:
            connection.close()

    def do_POST(self) -> None:
        connection = connect_database()
        try:
            prune_expired_sessions(connection)
            self.route_request("POST", connection)
        except AppError as exc:
            self.respond_error(exc.status, exc.message)
        finally:
            connection.close()

    def log_message(self, format: str, *args: Any) -> None:
        return

    def base_url(self) -> str:
        configured = os.getenv("PUBLIC_BASE_URL")
        if configured:
            return configured.rstrip("/")
        host = self.headers.get("Host", "localhost:8000")
        scheme = self.headers.get("X-Forwarded-Proto", "http")
        return f"{scheme}://{host}"

    def current_session_token(self) -> str | None:
        raw_cookie = self.headers.get("Cookie")
        if not raw_cookie:
            return None
        cookie = SimpleCookie()
        cookie.load(raw_cookie)
        morsel = cookie.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def current_user(self, connection: sqlite3.Connection) -> sqlite3.Row | None:
        token = self.current_session_token()
        if not token:
            return None
        row = connection.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ? AND sessions.expires_at >= ?
            """,
            (token, utc_iso()),
        ).fetchone()
        return row

    def require_user(self, connection: sqlite3.Connection) -> sqlite3.Row:
        row = self.current_user(connection)
        if not row:
            raise AppError("Please sign in with Discord first.", 401)
        return row

    def require_admin(self, connection: sqlite3.Connection) -> sqlite3.Row:
        row = self.require_user(connection)
        if not row["is_admin"]:
            raise AppError("You do not have access to admin tools.", 403)
        return row

    def read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            raise AppError(f"Invalid JSON body: {exc}", 400) from exc

    def route_request(self, method: str, connection: sqlite3.Connection) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if method == "GET" and path == "/api/config":
            self.handle_api_config()
            return
        if method == "GET" and path == "/api/me":
            self.handle_api_me(connection)
            return
        if method == "GET" and path == "/api/rewards":
            self.handle_api_rewards(connection)
            return
        if method == "GET" and path == "/api/casino/games":
            self.respond_json({"games": list_games(connection), "dailyWagerCap": DAILY_WAGER_CAP})
            return
        if method == "POST" and path == "/api/casino/spin":
            self.handle_api_spin(connection)
            return
        if method == "GET" and path == "/api/giveaways":
            self.handle_api_giveaways(connection)
            return
        if method == "POST" and path.startswith("/api/giveaways/") and path.endswith("/enter"):
            self.handle_api_giveaway_enter(connection, path)
            return
        if method == "GET" and path == "/api/admin/overview":
            actor = self.require_admin(connection)
            self.respond_json({"overview": admin_overview(connection), "actor": profile_payload(connection, actor)})
            return
        if method == "POST" and path == "/api/admin/rewards/grant":
            actor = self.require_admin(connection)
            result = grant_points(connection, actor, self.read_json_body())
            self.respond_json({"ok": True, "result": result})
            return
        if method == "POST" and path == "/api/admin/giveaways":
            actor = self.require_admin(connection)
            result = create_giveaway(connection, actor, self.read_json_body(), build_auth_config(self.base_url()))
            self.respond_json({"ok": True, "result": result}, status=201)
            return
        if method == "POST" and path.startswith("/api/admin/giveaways/") and path.endswith("/draw"):
            actor = self.require_admin(connection)
            giveaway_id = int(path.split("/")[-2])
            result = draw_giveaway_winner(connection, actor, giveaway_id, build_auth_config(self.base_url()))
            self.respond_json({"ok": True, "result": result})
            return
        if method == "GET" and path == "/auth/discord/login":
            self.handle_discord_login(connection, parsed)
            return
        if method == "GET" and path == "/auth/discord/callback":
            self.handle_discord_callback(connection, parsed)
            return
        if method == "GET" and path == "/auth/dev-login":
            self.handle_dev_login(connection, parsed)
            return
        if method == "POST" and path == "/auth/logout":
            destroy_session(connection, self.current_session_token())
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", session_cookie_header(delete=True))
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
            return

        if method == "GET":
            self.serve_static(path)
            return

        raise AppError("Not found.", 404)

    def handle_api_config(self) -> None:
        auth_config = build_auth_config(self.base_url())
        self.respond_json(
            {
                "authConfigured": auth_config.oauth_ready,
                "guildSyncConfigured": auth_config.guild_ready,
                "devAuthEnabled": env_flag("ENABLE_DEV_AUTH", False),
                "dailyWagerCap": DAILY_WAGER_CAP,
            }
        )

    def handle_api_me(self, connection: sqlite3.Connection) -> None:
        row = self.current_user(connection)
        if not row:
            self.respond_json({"authenticated": False})
            return
        self.respond_json({"authenticated": True, "user": profile_payload(connection, row)})

    def handle_api_rewards(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        self.respond_json(
            {
                "balance": get_balance(connection, row["id"]),
                "entries": recent_ledger(connection, row["id"]),
                "spins": recent_spins(connection, row["id"]),
            }
        )

    def handle_api_spin(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        payload = self.read_json_body()
        result = spin_game(connection, row, str(payload.get("gameSlug", "")).strip())
        self.respond_json({"ok": True, "result": result})

    def handle_api_giveaways(self, connection: sqlite3.Connection) -> None:
        row = self.current_user(connection)
        self.respond_json({"giveaways": list_giveaways(connection, row)})

    def handle_api_giveaway_enter(self, connection: sqlite3.Connection, path: str) -> None:
        row = self.require_user(connection)
        giveaway_id = int(path.split("/")[-2])
        result = enter_giveaway(connection, row, giveaway_id)
        self.respond_json({"ok": True, "result": result}, status=201)

    def handle_discord_login(self, connection: sqlite3.Connection, parsed: Any) -> None:
        auth_config = build_auth_config(self.base_url())
        if not auth_config.oauth_ready:
            raise AppError(
                "Discord auth is not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET first.",
                503,
            )
        next_path = parse_qs(parsed.query).get("next", ["/app/"])[0]
        state = create_auth_state(connection, next_path)
        params = urlencode(
            {
                "client_id": auth_config.client_id,
                "response_type": "code",
                "redirect_uri": auth_config.redirect_uri,
                "scope": "identify",
                "state": state,
            }
        )
        self.redirect(f"https://discord.com/api/oauth2/authorize?{params}")

    def handle_discord_callback(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        code = params.get("code", [None])[0]
        state = params.get("state", [None])[0]
        if not code or not state:
            raise AppError("Discord callback is missing required parameters.", 400)

        next_path = consume_auth_state(connection, state)
        if not next_path:
            raise AppError("Discord login state expired or is invalid.", 400)

        auth_config = build_auth_config(self.base_url())
        token = fetch_discord_token(code, auth_config)
        discord_user = fetch_discord_identity(token["access_token"])
        roles = fetch_discord_roles(str(discord_user["id"]), auth_config)
        row = create_or_update_user(connection, discord_user, roles)
        ensure_user_rewards(connection, row, auth_config)
        connection.commit()
        session_token = create_session(connection, row["id"])
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", next_path)
        self.send_header("Set-Cookie", session_cookie_header(session_token))
        self.end_headers()

    def handle_dev_login(self, connection: sqlite3.Connection, parsed: Any) -> None:
        if not env_flag("ENABLE_DEV_AUTH", False):
            raise AppError("Development auth is disabled.", 404)
        params = parse_qs(parsed.query)
        name = params.get("name", ["ghosted-dev"])[0]
        discord_id = params.get("discordId", ["dev-user-1"])[0]
        roles = [role for role in params.get("role", []) if role]
        fake_user = {
            "id": discord_id,
            "username": name,
            "global_name": name.title(),
            "avatar": None,
        }
        row = create_or_update_user(connection, fake_user, roles)
        ensure_user_rewards(connection, row, build_auth_config(self.base_url()))
        connection.commit()
        token = create_session(connection, row["id"])
        next_path = params.get("next", ["/app/"])[0]
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", next_path)
        self.send_header("Set-Cookie", session_cookie_header(token))
        self.end_headers()

    def static_target(self, path: str) -> Path | None:
        if path in {"/", "/index.html"}:
            return BASE_DIR / "index.html"
        if path == "/styles.css":
            return BASE_DIR / "styles.css"
        if path in {"/design", "/design/"}:
            return BASE_DIR / "design" / "index.html"
        if path.startswith("/design/"):
            return (BASE_DIR / path.lstrip("/")).resolve()
        if path in {"/app", "/app/"}:
            return BASE_DIR / "app" / "index.html"
        if path.startswith("/app/"):
            candidate = (BASE_DIR / path.lstrip("/")).resolve()
            if candidate.is_dir():
                candidate = candidate / "index.html"
            return candidate
        if path in {"/admin", "/admin/"}:
            return BASE_DIR / "admin" / "index.html"
        if path.startswith("/admin/"):
            candidate = (BASE_DIR / path.lstrip("/")).resolve()
            if candidate.is_dir():
                candidate = candidate / "index.html"
            return candidate
        return None

    def serve_static(self, path: str) -> None:
        target = self.static_target(path)
        if not target:
            raise AppError("Not found.", 404)
        if not target.exists() or not target.is_file():
            raise AppError("Not found.", 404)
        target = target.resolve()
        if BASE_DIR not in target.parents and target != BASE_DIR / "index.html":
            raise AppError("Not found.", 404)

        mime = STATIC_MIME_OVERRIDES.get(target.suffix) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        body = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.end_headers()

    def respond_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def respond_error(self, status: int, message: str) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.respond_json({"error": message}, status=status)
            return
        body = (
            "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width, initial-scale=1'>"
            "<title>Ghosted App Error</title><link rel='stylesheet' href='/styles.css'></head>"
            f"<body><main class='container' style='padding:4rem 0;'><p class='eyebrow'>Ghosted App</p>"
            f"<h1>{status}</h1><p class='hero__subtitle'>{message}</p>"
            "<a class='button' href='/'>Back to home</a></main></body></html>"
        ).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def create_server(port: int = 8000, host: str = "0.0.0.0") -> ThreadingHTTPServer:
    connection = connect_database()
    init_database(connection)
    connection.close()
    return ThreadingHTTPServer((host, port), GhostedHandler)


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    server = create_server(port, host)
    print(f"Ghosted app running at http://{host}:{port}")
    server.serve_forever()
