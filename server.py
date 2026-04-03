from __future__ import annotations

import json
import mimetypes
import os
import random
import re
import secrets
import sqlite3
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "data"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DB_DIR / "ghosted.db"))).expanduser()
SESSION_COOKIE = "ghosted_session"
SESSION_LIFETIME_DAYS = 14
STARTING_BALANCE = 250
MEMBER_ROLE_BONUS = 100
DAILY_WAGER_CAP: int | None = None
SPIN_COOLDOWN_SECONDS = 2
REQUEST_TIMEOUT = 10
RNG = random.SystemRandom()
DEFAULT_DISCORD_USER_AGENT = "DiscordBot (https://ghosted.smirkhub.com, 1.0)"
DEFAULT_WOM_API_BASE = "https://api.wiseoldman.net/v2"
DEFAULT_WOM_CACHE_TTL_SECONDS = 900
DEFAULT_WOM_PERIOD = "week"
DEFAULT_WOM_HISCORE_METRIC = "overall"
DISCORD_HTTP_HEADERS = {
    "User-Agent": DEFAULT_DISCORD_USER_AGENT,
    "Accept": "application/json",
}
WOM_HTTP_HEADERS = {
    "User-Agent": "GhostedApp/0.1 (+https://ghosted.smirkhub.com)",
    "Accept": "application/json",
}
STATIC_MIME_OVERRIDES = {
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}

DEFAULT_CASINO_GAMES = [
    {
        "slug": "jigsaw-jackpot",
        "name": "Jigsaw Jackpot",
        "cost": 20,
        "config": {
            "rows": 3,
            "paylines": [
                [1, 1, 1, 1, 1],
                [0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2],
                [0, 1, 2, 1, 0],
                [2, 1, 0, 1, 2],
                [0, 0, 1, 0, 0],
                [2, 2, 1, 2, 2],
                [1, 0, 0, 0, 1],
                [1, 2, 2, 2, 1],
                [0, 1, 1, 1, 0],
            ],
            "reel_strips": [
                ["coin", "moon", "ghost", "rune", "coin", "gem", "scatter", "moon", "coin", "mask", "wild", "ghost", "gem", "coin", "moon", "rune"],
                ["ghost", "coin", "gem", "rune", "moon", "mask", "coin", "scatter", "ghost", "moon", "wild", "rune", "coin", "gem", "moon", "coin"],
                ["moon", "coin", "ghost", "gem", "rune", "coin", "wild", "moon", "mask", "coin", "scatter", "ghost", "moon", "rune", "gem", "coin"],
                ["coin", "mask", "moon", "rune", "ghost", "coin", "gem", "wild", "moon", "scatter", "coin", "ghost", "rune", "moon", "coin", "gem"],
                ["gem", "coin", "moon", "ghost", "rune", "mask", "coin", "moon", "wild", "ghost", "coin", "scatter", "moon", "gem", "coin", "rune"],
            ],
            "symbol_payouts": {
                "wild": {"3": 2.5, "4": 10, "5": 40},
                "mask": {"3": 1.5, "4": 4, "5": 12},
                "gem": {"3": 1.2, "4": 3, "5": 10},
                "ghost": {"3": 0.8, "4": 2, "5": 6},
                "moon": {"3": 0.6, "4": 1.5, "5": 4},
                "rune": {"3": 0.5, "4": 1.2, "5": 3.5},
                "coin": {"3": 0.4, "4": 1, "5": 2.5},
            },
            "wild_symbol": "wild",
            "scatter_symbol": "scatter",
            "scatter_payouts": {"3": 1, "4": 4, "5": 15},
            "free_spins": {"3": 5, "4": 8, "5": 12},
            "top_payout": 1200,
            "flavor": "A 5x3 video slot with ten lines, sticky tension, and a classic free-spin trigger.",
            "volatility": "Medium",
            "mood": "Puzzle-box pressure",
            "jackpot_label": "5 Wilds x40",
            "accent": "#7bdff6",
            "hit_rate": 0.31,
            "return_rate": 0.93,
        },
    },
    {
        "slug": "ghost-lanterns",
        "name": "Ghost Lanterns",
        "cost": 35,
        "config": {
            "rows": 3,
            "paylines": [
                [1, 1, 1, 1, 1],
                [0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2],
                [0, 1, 2, 1, 0],
                [2, 1, 0, 1, 2],
                [1, 0, 1, 2, 1],
                [1, 2, 1, 0, 1],
                [0, 1, 0, 1, 2],
                [2, 1, 2, 1, 0],
                [0, 0, 1, 2, 2],
            ],
            "reel_strips": [
                ["coin", "moon", "lantern", "ghost", "rune", "coin", "wild", "lantern", "coin", "moon", "scatter", "ghost", "rune", "coin", "lantern", "moon"],
                ["ghost", "coin", "lantern", "rune", "moon", "coin", "ghost", "scatter", "wild", "moon", "rune", "coin", "lantern", "moon", "ghost", "coin"],
                ["moon", "coin", "ghost", "lantern", "rune", "coin", "moon", "wild", "lantern", "coin", "scatter", "ghost", "moon", "rune", "lantern", "coin"],
                ["coin", "lantern", "moon", "ghost", "rune", "coin", "wild", "lantern", "moon", "scatter", "coin", "ghost", "rune", "moon", "coin", "lantern"],
                ["lantern", "coin", "moon", "ghost", "rune", "coin", "moon", "wild", "ghost", "coin", "scatter", "lantern", "moon", "rune", "coin", "ghost"],
            ],
            "symbol_payouts": {
                "wild": {"3": 3, "4": 12, "5": 50},
                "lantern": {"3": 1.8, "4": 5, "5": 16},
                "ghost": {"3": 1.2, "4": 3.5, "5": 10},
                "moon": {"3": 0.8, "4": 2, "5": 5},
                "rune": {"3": 0.6, "4": 1.5, "5": 4},
                "coin": {"3": 0.5, "4": 1.2, "5": 3},
            },
            "wild_symbol": "wild",
            "scatter_symbol": "scatter",
            "scatter_payouts": {"3": 1.5, "4": 5, "5": 18},
            "free_spins": {"3": 6, "4": 10, "5": 14},
            "top_payout": 2200,
            "flavor": "Higher-volatility lantern slot with deeper free-spin awards and louder line wins.",
            "volatility": "High",
            "mood": "Haunted high-volatility cabinet",
            "jackpot_label": "5 Wilds x50",
            "accent": "#ffd166",
            "hit_rate": 0.27,
            "return_rate": 0.95,
        },
    },
    {
        "slug": "royal-heist",
        "name": "Royal Heist",
        "cost": 60,
        "config": {
            "rows": 3,
            "paylines": [
                [1, 1, 1, 1, 1],
                [0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2],
                [0, 1, 2, 1, 0],
                [2, 1, 0, 1, 2],
                [0, 1, 0, 1, 0],
                [2, 1, 2, 1, 2],
                [1, 0, 1, 0, 1],
                [1, 2, 1, 2, 1],
                [0, 1, 1, 1, 2],
            ],
            "reel_strips": [
                ["coin", "crown", "gem", "moon", "coin", "wild", "ghost", "gem", "scatter", "coin", "crown", "moon", "rune", "coin", "ghost", "gem"],
                ["gem", "coin", "crown", "ghost", "moon", "coin", "wild", "gem", "rune", "scatter", "coin", "moon", "crown", "ghost", "coin", "gem"],
                ["coin", "gem", "crown", "ghost", "wild", "moon", "coin", "scatter", "gem", "crown", "rune", "coin", "ghost", "moon", "gem", "coin"],
                ["ghost", "coin", "gem", "crown", "moon", "wild", "coin", "gem", "scatter", "rune", "coin", "crown", "ghost", "moon", "coin", "gem"],
                ["coin", "gem", "ghost", "moon", "crown", "coin", "wild", "scatter", "gem", "ghost", "coin", "moon", "crown", "rune", "coin", "gem"],
            ],
            "symbol_payouts": {
                "wild": {"3": 4, "4": 15, "5": 75},
                "crown": {"3": 2.5, "4": 7, "5": 22},
                "gem": {"3": 1.5, "4": 4.5, "5": 12},
                "ghost": {"3": 1, "4": 2.8, "5": 8},
                "moon": {"3": 0.8, "4": 2, "5": 5},
                "rune": {"3": 0.7, "4": 1.6, "5": 4},
                "coin": {"3": 0.5, "4": 1.3, "5": 3},
            },
            "wild_symbol": "wild",
            "scatter_symbol": "scatter",
            "scatter_payouts": {"3": 2, "4": 6, "5": 20},
            "free_spins": {"3": 7, "4": 10, "5": 15},
            "top_payout": 4500,
            "flavor": "Big-bet five-reel slot with premium crowns, fat wild lines, and long free-spin chains.",
            "volatility": "High",
            "mood": "High-limit centerpiece",
            "jackpot_label": "5 Wilds x75",
            "accent": "#ff5d8f",
            "hit_rate": 0.24,
            "return_rate": 0.96,
        },
    },
]


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
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


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


def env_text(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1].strip()
    return value or None


def env_int(name: str, default: int) -> int:
    value = env_text(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def wom_api_base() -> str:
    return (env_text("WOM_API_BASE") or DEFAULT_WOM_API_BASE).rstrip("/")


def wom_group_id() -> int | None:
    value = env_text("WOM_GROUP_ID")
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def wom_cache_ttl_seconds() -> int:
    return max(60, env_int("WOM_CACHE_TTL_SECONDS", DEFAULT_WOM_CACHE_TTL_SECONDS))


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
    raw = env_text("ADMIN_DISCORD_IDS") or ""
    return {item.strip() for item in raw.split(",") if item.strip()}


def discord_request_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = dict(DISCORD_HTTP_HEADERS)
    headers["User-Agent"] = env_text("DISCORD_USER_AGENT") or headers["User-Agent"]
    if extra:
        headers.update(extra)
    return headers


def build_auth_config(base_url: str | None = None) -> AuthConfig:
    redirect_uri = env_text("DISCORD_REDIRECT_URI")
    if not redirect_uri and base_url:
        redirect_uri = f"{base_url}/auth/discord/callback"
    return AuthConfig(
        client_id=env_text("DISCORD_CLIENT_ID"),
        client_secret=env_text("DISCORD_CLIENT_SECRET"),
        redirect_uri=redirect_uri,
        guild_id=env_text("DISCORD_GUILD_ID"),
        bot_token=env_text("DISCORD_BOT_TOKEN"),
        member_role_id=env_text("DISCORD_MEMBER_ROLE_ID"),
        vip_role_id=env_text("DISCORD_VIP_ROLE_ID"),
        giveaway_role_id=env_text("DISCORD_GIVEAWAY_ROLE_ID"),
        webhook_url=env_text("DISCORD_WEBHOOK_URL"),
    )


def role_label_overrides() -> dict[str, str]:
    raw = env_text("DISCORD_ROLE_LABELS_JSON")
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"DISCORD_ROLE_LABELS_JSON is invalid JSON: {exc}", file=sys.stderr)
        return {}
    if not isinstance(payload, dict):
        print("DISCORD_ROLE_LABELS_JSON must be a JSON object of role IDs to labels.", file=sys.stderr)
        return {}

    overrides: dict[str, str] = {}
    for role_id, label in payload.items():
        normalized_id = str(role_id).strip()
        normalized_label = str(label).strip()
        if normalized_id and normalized_label:
            overrides[normalized_id] = normalized_label
    return overrides


def resolved_role(role_id: str | None, role_directory: dict[str, dict[str, str]]) -> dict[str, str] | None:
    normalized_id = str(role_id or "").strip()
    if not normalized_id:
        return None
    role = role_directory.get(normalized_id)
    if role:
        return dict(role)
    return {"id": normalized_id, "label": normalized_id, "source": "id"}


def resolve_roles(role_ids: list[str], role_directory: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    return [resolved for role_id in unique_in_order(role_ids) if (resolved := resolved_role(role_id, role_directory))]


def sorted_role_options(role_directory: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    return sorted(role_directory.values(), key=lambda item: (item["label"].lower(), item["id"]))


def connect_database(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def unique_in_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        item = str(value)
        if item and item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def require_wom_group_id() -> int:
    group_id = wom_group_id()
    if group_id is None:
        raise AppError("Wise Old Man integration is not configured yet.", 503)
    return group_id


def wom_url(path: str, query: dict[str, Any] | None = None) -> str:
    base = wom_api_base()
    normalized_query = {
        key: value
        for key, value in (query or {}).items()
        if value is not None and value != ""
    }
    query_string = urlencode(normalized_query, doseq=True)
    return f"{base}/{path.lstrip('/')}{'?' + query_string if query_string else ''}"


def wom_cache_key(path: str, query: dict[str, Any] | None = None) -> str:
    normalized_query = []
    for key, value in sorted((query or {}).items()):
        if value is None or value == "":
            continue
        if isinstance(value, list):
            for item in value:
                normalized_query.append((key, str(item)))
        else:
            normalized_query.append((key, str(value)))
    if not normalized_query:
        return path.lstrip("/")
    return f"{path.lstrip('/')}?{urlencode(normalized_query, doseq=True)}"


def wom_http_error_message(exc: HTTPError) -> str:
    body = exc.read().decode("utf-8", errors="replace")
    return body or exc.reason or f"HTTP {exc.code}"


def wom_request_json(
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    query: dict[str, Any] | None = None,
) -> Any:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = dict(WOM_HTTP_HEADERS)
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = Request(
        wom_url(path, query),
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise AppError(f"Wise Old Man request failed: {wom_http_error_message(exc)}", 502) from exc
    except URLError as exc:
        raise AppError(f"Wise Old Man request failed: {exc}", 502) from exc


def get_wom_cache_entry(connection: sqlite3.Connection, cache_key: str) -> sqlite3.Row | None:
    return connection.execute("SELECT * FROM wom_cache WHERE cache_key = ?", (cache_key,)).fetchone()


def set_wom_cache_entry(connection: sqlite3.Connection, cache_key: str, payload: Any) -> None:
    fetched_at = utc_now()
    connection.execute(
        """
        INSERT INTO wom_cache (cache_key, payload_json, fetched_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            payload_json = excluded.payload_json,
            fetched_at = excluded.fetched_at,
            expires_at = excluded.expires_at
        """,
        (
            cache_key,
            json.dumps(payload),
            utc_iso(fetched_at),
            utc_iso(fetched_at + timedelta(seconds=wom_cache_ttl_seconds())),
        ),
    )
    connection.commit()


def wom_cached_json(
    connection: sqlite3.Connection,
    path: str,
    *,
    query: dict[str, Any] | None = None,
    force_refresh: bool = False,
    allow_stale: bool = True,
) -> Any:
    cache_key = wom_cache_key(path, query)
    cached_row = None if force_refresh else get_wom_cache_entry(connection, cache_key)
    if cached_row:
        cached_payload = json_loads(cached_row["payload_json"], {})
        expires_at = parse_iso(cached_row["expires_at"])
        if expires_at and expires_at >= utc_now():
            return cached_payload
    else:
        cached_payload = None

    try:
        payload = wom_request_json(path, query=query)
        set_wom_cache_entry(connection, cache_key, payload)
        return payload
    except AppError:
        if cached_row and allow_stale:
            return cached_payload
        raise


def invalidate_wom_cache(connection: sqlite3.Connection, prefix: str | None = None) -> int:
    if prefix:
        cursor = connection.execute("DELETE FROM wom_cache WHERE cache_key LIKE ?", (f"{prefix}%",))
    else:
        cursor = connection.execute("DELETE FROM wom_cache")
    connection.commit()
    return int(cursor.rowcount or 0)


def get_user_game_account(connection: sqlite3.Connection, user_id: int, game: str = "osrs") -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT *
        FROM user_game_accounts
        WHERE user_id = ? AND game = ?
        ORDER BY is_primary DESC, id ASC
        LIMIT 1
        """,
        (user_id, game),
    ).fetchone()


def count_linked_game_accounts(connection: sqlite3.Connection, game: str = "osrs") -> int:
    row = connection.execute(
        "SELECT COUNT(*) AS count FROM user_game_accounts WHERE game = ? AND is_primary = 1",
        (game,),
    ).fetchone()
    return int(row["count"])


def save_user_game_account(
    connection: sqlite3.Connection,
    user_id: int,
    game: str,
    player: dict[str, Any],
) -> sqlite3.Row:
    existing = get_user_game_account(connection, user_id, game)
    now = utc_iso()
    try:
        connection.execute(
            """
            INSERT INTO user_game_accounts (
                user_id, game, wom_player_id, username, display_name, status, is_primary, linked_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(user_id, game) DO UPDATE SET
                wom_player_id = excluded.wom_player_id,
                username = excluded.username,
                display_name = excluded.display_name,
                status = excluded.status,
                is_primary = 1,
                updated_at = excluded.updated_at
            """,
            (
                user_id,
                game,
                int(player["id"]),
                str(player.get("username") or "").strip(),
                str(player.get("displayName") or player.get("username") or "").strip(),
                str(player.get("status") or "unknown").strip() or "unknown",
                existing["linked_at"] if existing else now,
                now,
            ),
        )
    except sqlite3.IntegrityError as exc:
        raise AppError("That Wise Old Man account is already linked to another Ghosted user.", 409) from exc
    connection.commit()
    return get_user_game_account(connection, user_id, game)


def delete_user_game_account(connection: sqlite3.Connection, user_id: int, game: str = "osrs") -> None:
    connection.execute("DELETE FROM user_game_accounts WHERE user_id = ? AND game = ?", (user_id, game))
    connection.commit()


def player_in_group(group_id: int, memberships: list[dict[str, Any]]) -> bool:
    target = str(group_id)
    for membership in memberships:
        if str(membership.get("groupId")) == target:
            return True
        group = membership.get("group") or {}
        if str(group.get("id")) == target:
            return True
    return False


def wom_link_payload(connection: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    account = get_user_game_account(connection, user_id, "osrs")
    if not account:
        return {
            "linked": False,
            "playerId": None,
            "username": None,
            "displayName": None,
            "inGroup": False,
            "lastSyncedAt": None,
            "status": "unlinked",
        }
    return {
        "linked": True,
        "playerId": int(account["wom_player_id"]),
        "username": account["username"],
        "displayName": account["display_name"],
        "inGroup": True,
        "lastSyncedAt": account["updated_at"],
        "status": account["status"],
    }


def link_wom_account(connection: sqlite3.Connection, user_row: sqlite3.Row, username: str) -> dict[str, Any]:
    normalized_username = str(username or "").strip()
    if not normalized_username:
        raise AppError("Runescape username is required.", 400)

    group_id = require_wom_group_id()
    player = wom_request_json(f"/players/{quote(normalized_username)}", method="POST")
    memberships = wom_cached_json(connection, f"/players/{quote(player['username'])}/groups")
    if not player_in_group(group_id, memberships):
        raise AppError("That Wise Old Man player is not in the configured Ghosted group.", 400)

    account = save_user_game_account(connection, int(user_row["id"]), "osrs", player)
    audit(
        connection,
        int(user_row["id"]),
        "link_wom_account",
        "user_game_account",
        str(account["id"]),
        {
            "game": "osrs",
            "womPlayerId": int(account["wom_player_id"]),
            "username": account["username"],
        },
    )
    connection.commit()
    return wom_link_payload(connection, int(user_row["id"]))


def unlink_wom_account(connection: sqlite3.Connection, user_row: sqlite3.Row) -> dict[str, Any]:
    account = get_user_game_account(connection, int(user_row["id"]), "osrs")
    if account:
        delete_user_game_account(connection, int(user_row["id"]), "osrs")
        audit(
            connection,
            int(user_row["id"]),
            "unlink_wom_account",
            "user_game_account",
            str(account["id"]),
            {"game": "osrs", "womPlayerId": int(account["wom_player_id"])},
        )
        connection.commit()
    return wom_link_payload(connection, int(user_row["id"]))


def competition_status(starts_at: str | None, ends_at: str | None, now: datetime | None = None) -> str:
    current = now or utc_now()
    starts = parse_iso(starts_at)
    ends = parse_iso(ends_at)
    if starts and current < starts:
        return "upcoming"
    if ends and current > ends:
        return "finished"
    return "ongoing"


def normalize_group_hiscores(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, entry in enumerate(entries, start=1):
        player = entry.get("player") or {}
        data = entry.get("data") or {}
        normalized.append(
            {
                "rank": int(data.get("rank") or index),
                "player": {
                    "id": player.get("id"),
                    "username": player.get("username"),
                    "displayName": player.get("displayName") or player.get("username"),
                },
                "value": data.get("experience", data.get("kills", data.get("score", data.get("value", 0)))),
                "raw": data,
            }
        )
    return normalized


def normalize_group_gains(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, entry in enumerate(entries, start=1):
        player = entry.get("player") or {}
        normalized.append(
            {
                "rank": index,
                "player": {
                    "id": player.get("id"),
                    "username": player.get("username"),
                    "displayName": player.get("displayName") or player.get("username"),
                },
                "gained": entry.get("gained", 0),
                "raw": entry,
            }
        )
    return normalized


def normalize_group_activity(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for entry in entries:
        player = entry.get("player") or {}
        normalized.append(
            {
                "type": entry.get("type"),
                "role": entry.get("role"),
                "createdAt": entry.get("createdAt"),
                "player": {
                    "id": player.get("id"),
                    "username": player.get("username"),
                    "displayName": player.get("displayName") or player.get("username"),
                },
            }
        )
    return normalized


def normalize_achievements(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for entry in entries:
        player = entry.get("player") or {}
        normalized.append(
            {
                "name": entry.get("name"),
                "metric": entry.get("metric"),
                "measure": entry.get("measure"),
                "threshold": entry.get("threshold"),
                "createdAt": entry.get("createdAt"),
                "player": {
                    "id": player.get("id"),
                    "username": player.get("username"),
                    "displayName": player.get("displayName") or player.get("username"),
                },
            }
        )
    return normalized


def normalize_competition_item(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": entry.get("id"),
        "title": entry.get("title"),
        "metric": entry.get("metric"),
        "type": entry.get("type"),
        "startsAt": entry.get("startsAt"),
        "endsAt": entry.get("endsAt"),
        "groupId": entry.get("groupId"),
        "score": entry.get("score"),
        "status": competition_status(entry.get("startsAt"), entry.get("endsAt")),
        "participantCount": len(entry.get("participants") or []),
        "raw": entry,
    }


def normalize_competition_participants(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, entry in enumerate(entries, start=1):
        player = entry.get("player") or {}
        progress = entry.get("progress") or {}
        normalized.append(
            {
                "rank": int(entry.get("rank") or index),
                "player": {
                    "id": player.get("id"),
                    "username": player.get("username"),
                    "displayName": player.get("displayName") or player.get("username"),
                },
                "progress": {
                    "start": progress.get("start"),
                    "end": progress.get("end"),
                    "gained": progress.get("gained", entry.get("gained", 0)),
                },
                "updatedAt": entry.get("updatedAt") or player.get("updatedAt"),
                "raw": entry,
            }
        )
    return normalized


def normalize_competition_history(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for entry in entries:
        player = entry.get("player") or {}
        normalized.append(
            {
                "player": {
                    "id": player.get("id"),
                    "username": player.get("username"),
                    "displayName": player.get("displayName") or player.get("username"),
                },
                "history": entry.get("history") or [],
            }
        )
    return normalized


def group_link_coverage(connection: sqlite3.Connection, group: dict[str, Any] | None = None) -> dict[str, int]:
    total_users = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    linked_users = count_linked_game_accounts(connection, "osrs")
    member_count = int((group or {}).get("memberCount") or 0)
    return {
        "trackedUsers": int(total_users),
        "linkedUsers": linked_users,
        "unlinkedUsers": max(0, int(total_users) - linked_users),
        "groupMemberCount": member_count,
    }


def average_skill(statistics: dict[str, Any], metric: str) -> dict[str, Any]:
    return (((statistics.get("averageStats") or {}).get("data") or {}).get("skills") or {}).get(metric) or {}


def average_computed(statistics: dict[str, Any], metric: str) -> dict[str, Any]:
    return (((statistics.get("averageStats") or {}).get("data") or {}).get("computed") or {}).get(metric) or {}


def slot_rows(config: dict[str, Any]) -> int:
    return max(1, int(config.get("rows", 3)))


def slot_paylines(config: dict[str, Any]) -> list[list[int]]:
    return [list(map(int, line)) for line in config.get("paylines", [])]


def slot_reel_strips(config: dict[str, Any]) -> list[list[str]]:
    return [[str(symbol) for symbol in strip if symbol] for strip in config.get("reel_strips", [])]


def slot_symbol_pool(config: dict[str, Any]) -> list[str]:
    strips = slot_reel_strips(config)
    return unique_in_order([symbol for strip in strips for symbol in strip])


def slot_payout_table(config: dict[str, Any]) -> dict[str, dict[int, float]]:
    payout_table: dict[str, dict[int, float]] = {}
    for symbol, counts in config.get("symbol_payouts", {}).items():
        payout_table[str(symbol)] = {int(count): float(multiplier) for count, multiplier in counts.items()}
    return payout_table


def slot_scatter_payouts(config: dict[str, Any]) -> dict[int, float]:
    return {int(count): float(multiplier) for count, multiplier in config.get("scatter_payouts", {}).items()}


def slot_free_spin_table(config: dict[str, Any]) -> dict[int, int]:
    return {int(count): int(amount) for count, amount in config.get("free_spins", {}).items()}


def round_points(value: float) -> int:
    return int(round(value))


def build_paytable(cost: int, config: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    payout_table = slot_payout_table(config)
    scatter_symbol = str(config.get("scatter_symbol", "scatter"))

    for symbol, count_map in payout_table.items():
        for count, multiplier in sorted(count_map.items(), reverse=True):
            entries.append(
                {
                    "kind": "line",
                    "symbol": symbol,
                    "count": count,
                    "symbols": [symbol] * count,
                    "multiplier": float(multiplier),
                    "payout": round_points(cost * float(multiplier)),
                    "label": f"{count} {symbol.title()}",
                }
            )

    for count, multiplier in sorted(slot_scatter_payouts(config).items(), reverse=True):
        entries.append(
            {
                "kind": "scatter",
                "symbol": scatter_symbol,
                "count": count,
                "symbols": [scatter_symbol] * count,
                "multiplier": float(multiplier),
                "payout": round_points(cost * float(multiplier)),
                "freeSpins": slot_free_spin_table(config).get(count, 0),
                "label": f"{count} Scatter",
            }
        )

    return sorted(entries, key=lambda entry: (entry["payout"], entry["count"]), reverse=True)


def calculate_machine_metrics(cost: int, config: dict[str, Any]) -> dict[str, float]:
    return {
        "hit_rate": float(config.get("hit_rate", 0.0)),
        "return_rate": float(config.get("return_rate", 0.0)),
    }


def visible_grid_from_strips(
    strips: list[list[str]],
    rows: int,
    rng: random.Random | random.SystemRandom,
) -> tuple[list[list[str]], list[int]]:
    reels: list[list[str]] = []
    stops: list[int] = []
    for strip in strips:
        stop = rng.randrange(len(strip))
        reels.append([strip[(stop + offset) % len(strip)] for offset in range(rows)])
        stops.append(stop)
    return reels, stops


def line_symbol_for_evaluation(
    line_symbols: list[str],
    wild_symbol: str,
    scatter_symbol: str,
) -> str | None:
    for symbol in line_symbols:
        if symbol not in {wild_symbol, scatter_symbol}:
            return symbol
    return wild_symbol if line_symbols and all(symbol == wild_symbol for symbol in line_symbols) else None


def evaluate_payline(
    line: list[int],
    reels: list[list[str]],
    cost: int,
    config: dict[str, Any],
    line_index: int,
) -> dict[str, Any] | None:
    wild_symbol = str(config.get("wild_symbol", "wild"))
    scatter_symbol = str(config.get("scatter_symbol", "scatter"))
    payout_table = slot_payout_table(config)
    line_symbols = [reels[reel_index][row_index] for reel_index, row_index in enumerate(line)]
    target_symbol = line_symbol_for_evaluation(line_symbols, wild_symbol, scatter_symbol)
    if not target_symbol:
        return None

    match_count = 0
    positions: list[list[int]] = []
    for reel_index, symbol in enumerate(line_symbols):
        if symbol == scatter_symbol:
            break
        if symbol == target_symbol or (symbol == wild_symbol and target_symbol != scatter_symbol):
            match_count += 1
            positions.append([reel_index, line[reel_index]])
            continue
        break

    payouts = payout_table.get(target_symbol, {})
    if match_count < 3 or match_count not in payouts:
        return None

    payout = round_points(cost * payouts[match_count])
    return {
        "lineIndex": line_index,
        "symbol": target_symbol,
        "count": match_count,
        "positions": positions,
        "symbols": line_symbols,
        "multiplier": payouts[match_count],
        "payout": payout,
    }


def evaluate_scatter(reels: list[list[str]], cost: int, config: dict[str, Any]) -> dict[str, Any]:
    scatter_symbol = str(config.get("scatter_symbol", "scatter"))
    positions = [
        [reel_index, row_index]
        for reel_index, reel in enumerate(reels)
        for row_index, symbol in enumerate(reel)
        if symbol == scatter_symbol
    ]
    count = len(positions)
    payouts = slot_scatter_payouts(config)
    free_spins = slot_free_spin_table(config)
    payout = round_points(cost * payouts.get(count, 0.0))
    awarded = free_spins.get(count, 0)
    return {
        "count": count,
        "positions": positions,
        "payout": payout,
        "freeSpinsAwarded": awarded,
        "symbol": scatter_symbol,
    }


def summarize_slot_outcome(
    game_name: str,
    wager: int,
    total_payout: int,
    line_wins: list[dict[str, Any]],
    scatter: dict[str, Any],
    used_free_spin: bool,
) -> dict[str, Any]:
    if scatter["freeSpinsAwarded"]:
        return {
            "type": "bonus",
            "label": "Bonus trigger",
            "headline": f"{game_name} opened a free-spin round.",
            "detail": f"{scatter['count']} scatters awarded {scatter['freeSpinsAwarded']} free spins.",
        }
    if line_wins:
        top_line = max(line_wins, key=lambda item: item["payout"])
        line_type = "Jackpot" if top_line["count"] == 5 and top_line["payout"] >= wager * 10 else "Line hit"
        return {
            "type": "jackpot" if line_type == "Jackpot" else "line_win",
            "label": line_type,
            "headline": f"{game_name} paid on line {top_line['lineIndex'] + 1}.",
            "detail": f"{top_line['count']} {top_line['symbol']} symbols connected for {top_line['payout']} points.",
        }
    if scatter["count"] >= 2:
        return {
            "type": "near_miss",
            "label": "Near miss",
            "headline": f"{game_name} almost triggered the feature.",
            "detail": f"{scatter['count']} scatters landed. One more would have opened free spins.",
        }
    return {
        "type": "free_spin_miss" if used_free_spin else "miss",
        "label": "No win",
        "headline": f"{game_name} came up cold.",
        "detail": "No paylines connected on that spin." if not used_free_spin else "The free spin landed dry this round.",
    }


def normalize_spin_storage(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):
        return {"symbols": raw, "grid": [raw]}
    return {"symbols": [], "grid": []}


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

        CREATE TABLE IF NOT EXISTS casino_bonus_state (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_id INTEGER NOT NULL REFERENCES casino_games(id) ON DELETE CASCADE,
            free_spins_remaining INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, game_id)
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

        CREATE TABLE IF NOT EXISTS user_game_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game TEXT NOT NULL,
            wom_player_id INTEGER NOT NULL UNIQUE,
            username TEXT NOT NULL,
            display_name TEXT NOT NULL,
            status TEXT NOT NULL,
            is_primary INTEGER NOT NULL DEFAULT 1,
            linked_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, game)
        );

        CREATE TABLE IF NOT EXISTS wom_cache (
            cache_key TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );
        """
    )
    seed_default_games(connection)
    seed_default_giveaway(connection)
    connection.commit()


def seed_default_games(connection: sqlite3.Connection) -> None:
    created_at = utc_iso()
    for game in DEFAULT_CASINO_GAMES:
        connection.execute(
            """
            INSERT INTO casino_games (slug, name, cost, config_json, active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                cost = excluded.cost,
                config_json = excluded.config_json,
                active = excluded.active
            """,
            (game["slug"], game["name"], game["cost"], json.dumps(game["config"]), created_at),
        )
    allowed_slugs = tuple(game["slug"] for game in DEFAULT_CASINO_GAMES)
    placeholders = ", ".join("?" for _ in allowed_slugs)
    connection.execute(
        f"UPDATE casino_games SET active = CASE WHEN slug IN ({placeholders}) THEN 1 ELSE 0 END",
        allowed_slugs,
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
        headers=discord_request_headers({"Content-Type": "application/x-www-form-urlencoded"}),
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
        headers=discord_request_headers({"Authorization": f"Bearer {access_token}"}),
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
        headers=discord_request_headers({"Authorization": f"Bot {auth_config.bot_token}"}),
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return [str(role) for role in payload.get("roles", [])]
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(
            f"Discord role sync warning for guild {auth_config.guild_id} user {discord_id}: HTTP {exc.code}: {body}",
            file=sys.stderr,
        )
        return []
    except URLError as exc:
        print(
            f"Discord role sync warning for guild {auth_config.guild_id} user {discord_id}: {exc}",
            file=sys.stderr,
        )
        return []


def fetch_discord_guild_roles(auth_config: AuthConfig) -> dict[str, str]:
    if not auth_config.guild_ready:
        return {}
    request = Request(
        f"https://discord.com/api/guilds/{auth_config.guild_id}/roles",
        headers=discord_request_headers({"Authorization": f"Bot {auth_config.bot_token}"}),
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(
            f"Discord guild role lookup warning for guild {auth_config.guild_id}: HTTP {exc.code}: {body}",
            file=sys.stderr,
        )
        return {}
    except URLError as exc:
        print(
            f"Discord guild role lookup warning for guild {auth_config.guild_id}: {exc}",
            file=sys.stderr,
        )
        return {}

    if not isinstance(payload, list):
        print(
            f"Discord guild role lookup warning for guild {auth_config.guild_id}: unexpected payload shape.",
            file=sys.stderr,
        )
        return {}

    roles: dict[str, str] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        role_id = str(item.get("id", "")).strip()
        role_name = str(item.get("name", "")).strip()
        if role_id and role_name:
            roles[role_id] = role_name
    return roles


def build_role_directory(auth_config: AuthConfig) -> dict[str, dict[str, str]]:
    directory = {
        role_id: {"id": role_id, "label": label, "source": "discord"}
        for role_id, label in fetch_discord_guild_roles(auth_config).items()
    }
    for role_id, label in role_label_overrides().items():
        directory[role_id] = {"id": role_id, "label": label, "source": "alias"}
    return directory


def post_webhook(content: str, auth_config: AuthConfig) -> None:
    if not auth_config.webhook_url:
        return
    payload = json.dumps({"content": content}).encode("utf-8")
    request = Request(
        auth_config.webhook_url,
        data=payload,
        headers=discord_request_headers({"Content-Type": "application/json"}),
        method="POST",
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT):
            return
    except (HTTPError, URLError):
        return


def list_games(connection: sqlite3.Connection, user_id: int | None = None) -> list[dict[str, Any]]:
    rows = connection.execute(
        "SELECT * FROM casino_games WHERE active = 1 ORDER BY cost ASC, id ASC"
    ).fetchall()
    bonuses = bonus_state_map(connection, user_id) if user_id is not None else {}
    games: list[dict[str, Any]] = []
    for row in rows:
        config = json_loads(row["config_json"], {})
        metrics = calculate_machine_metrics(row["cost"], config)
        strips = slot_reel_strips(config)
        symbol_pool = slot_symbol_pool(config)
        games.append(
            {
                "id": row["id"],
                "slug": row["slug"],
                "name": row["name"],
                "cost": row["cost"],
                "topPayout": config.get("top_payout", row["cost"]),
                "flavor": config.get("flavor", ""),
                "volatility": config.get("volatility", "Medium"),
                "mood": config.get("mood", ""),
                "jackpotLabel": config.get("jackpot_label", ""),
                "accent": config.get("accent", "#9d7cf2"),
                "rows": slot_rows(config),
                "reelCount": len(strips),
                "paylinesCount": len(slot_paylines(config)),
                "reelSymbols": symbol_pool,
                "paytable": build_paytable(row["cost"], config),
                "hitRate": metrics["hit_rate"],
                "returnRate": metrics["return_rate"],
                "wildSymbol": config.get("wild_symbol", "wild"),
                "scatterSymbol": config.get("scatter_symbol", "scatter"),
                "freeSpinsRemaining": bonuses.get(int(row["id"]), 0),
            }
        )
    return games


def evaluate_spin(
    game_row: sqlite3.Row,
    rng: random.Random | random.SystemRandom | None = None,
) -> dict[str, Any]:
    rng = rng or RNG
    config = json_loads(game_row["config_json"], {})
    strips = slot_reel_strips(config)
    rows = slot_rows(config)
    paylines = slot_paylines(config)
    reels, stops = visible_grid_from_strips(strips, rows, rng)
    line_wins = [
        win
        for line_index, line in enumerate(paylines)
        for win in [evaluate_payline(line, reels, int(game_row["cost"]), config, line_index)]
        if win
    ]
    scatter = evaluate_scatter(reels, int(game_row["cost"]), config)
    payout = sum(int(win["payout"]) for win in line_wins) + int(scatter["payout"])
    center_row = min(1, max(0, rows - 1))
    symbols = [reel[center_row] for reel in reels]
    return {
        "symbols": symbols,
        "grid": reels,
        "stops": stops,
        "lineWins": line_wins,
        "scatter": scatter,
        "payout": payout,
    }


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


def daily_wager_status(connection: sqlite3.Connection, user_id: int) -> dict[str, int | None]:
    wagered = total_wagered_today(connection, user_id)
    remaining = None if DAILY_WAGER_CAP is None else max(0, DAILY_WAGER_CAP - wagered)
    return {
        "dailyWagered": wagered,
        "dailyRemaining": remaining,
        "dailyCap": DAILY_WAGER_CAP,
    }


def bonus_state_map(connection: sqlite3.Connection, user_id: int) -> dict[int, int]:
    rows = connection.execute(
        "SELECT game_id, free_spins_remaining FROM casino_bonus_state WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    return {int(row["game_id"]): int(row["free_spins_remaining"]) for row in rows}


def free_spins_remaining(connection: sqlite3.Connection, user_id: int, game_id: int) -> int:
    row = connection.execute(
        """
        SELECT free_spins_remaining
        FROM casino_bonus_state
        WHERE user_id = ? AND game_id = ?
        """,
        (user_id, game_id),
    ).fetchone()
    return int(row["free_spins_remaining"]) if row else 0


def set_free_spins_remaining(
    connection: sqlite3.Connection,
    user_id: int,
    game_id: int,
    remaining: int,
) -> None:
    connection.execute(
        """
        INSERT INTO casino_bonus_state (user_id, game_id, free_spins_remaining, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, game_id) DO UPDATE SET
            free_spins_remaining = excluded.free_spins_remaining,
            updated_at = excluded.updated_at
        """,
        (user_id, game_id, max(0, int(remaining)), utc_iso()),
    )


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

    previous_spin = last_spin_time(connection, user_row["id"])
    if previous_spin and (utc_now() - previous_spin).total_seconds() < SPIN_COOLDOWN_SECONDS:
        raise AppError("Slow down a little between spins.", 429)

    remaining_before = free_spins_remaining(connection, user_row["id"], int(game_row["id"]))
    used_free_spin = remaining_before > 0
    wager = 0 if used_free_spin else int(game_row["cost"])
    balance = get_balance(connection, user_row["id"])
    if not used_free_spin and balance < game_row["cost"]:
        raise AppError("You do not have enough points for that spin.", 400)

    if (
        not used_free_spin
        and DAILY_WAGER_CAP is not None
        and total_wagered_today(connection, user_row["id"]) + game_row["cost"] > DAILY_WAGER_CAP
    ):
        raise AppError("You have reached the daily wager cap. Try again tomorrow.", 429)

    if wager:
        append_ledger(
            connection,
            user_row["id"],
            -wager,
            "casino_wager",
            f"Wagered on {game_row['name']}.",
            {"game_slug": game_slug, "cost": wager},
        )

    spin = evaluate_spin(game_row, rng=rng)
    free_spin_award = int(spin["scatter"]["freeSpinsAwarded"])
    remaining_after = max(0, remaining_before - (1 if used_free_spin else 0)) + free_spin_award
    set_free_spins_remaining(connection, user_row["id"], int(game_row["id"]), remaining_after)
    connection.execute(
        """
        INSERT INTO casino_spins (user_id, game_id, wager, payout, symbols_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_row["id"],
            game_row["id"],
            wager,
            int(spin["payout"]),
            json.dumps(
                {
                    "symbols": spin["symbols"],
                    "grid": spin["grid"],
                    "stops": spin["stops"],
                    "lineWins": spin["lineWins"],
                    "scatter": spin["scatter"],
                    "freeSpinsAwarded": free_spin_award,
                    "freeSpinsRemaining": remaining_after,
                    "usedFreeSpin": used_free_spin,
                }
            ),
            utc_iso(),
        ),
    )
    if spin["payout"]:
        append_ledger(
            connection,
            user_row["id"],
            int(spin["payout"]),
            "casino_payout",
            f"Hit a payout on {game_row['name']}{' (free spin)' if used_free_spin else ''}.",
            {
                "game_slug": game_slug,
                "symbols": spin["symbols"],
                "payout": int(spin["payout"]),
                "used_free_spin": used_free_spin,
            },
        )
    connection.commit()

    outcome = summarize_slot_outcome(
        game_row["name"],
        wager or int(game_row["cost"]),
        int(spin["payout"]),
        spin["lineWins"],
        spin["scatter"],
        used_free_spin,
    )
    result = {
        "game": game_row["name"],
        "gameSlug": game_slug,
        "symbols": spin["symbols"],
        "grid": spin["grid"],
        "lineWins": spin["lineWins"],
        "scatter": spin["scatter"],
        "wager": wager,
        "baseWager": int(game_row["cost"]),
        "payout": int(spin["payout"]),
        "net": int(spin["payout"]) - wager,
        "usedFreeSpin": used_free_spin,
        "freeSpinsAwarded": free_spin_award,
        "freeSpinsRemaining": remaining_after,
        "balance": get_balance(connection, user_row["id"]),
        "outcome": outcome,
    }
    result.update(daily_wager_status(connection, user_row["id"]))
    return result


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


def list_giveaways(
    connection: sqlite3.Connection,
    user_row: sqlite3.Row | None = None,
    role_directory: dict[str, dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
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
    role_directory = role_directory or {}
    roles = set(user_roles(user_row))
    balance = get_balance(connection, user_row["id"]) if user_row else 0
    for row in rows:
        status = giveaway_status(row)
        required_role = row["required_role_id"]
        required_role_ref = resolved_role(required_role, role_directory)
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
                "requiredRole": required_role_ref,
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
            "net": int(row["payout"]) - int(row["wager"]),
            "symbols": payload.get("symbols", []),
            "grid": payload.get("grid", []),
            "lineWins": payload.get("lineWins", []),
            "scatter": payload.get("scatter", {"count": 0, "payout": 0, "freeSpinsAwarded": 0}),
            "usedFreeSpin": bool(payload.get("usedFreeSpin", False)),
            "freeSpinsAwarded": int(payload.get("freeSpinsAwarded", 0)),
            "freeSpinsRemaining": int(payload.get("freeSpinsRemaining", 0)),
            "createdAt": row["created_at"],
            "outcome": summarize_slot_outcome(
                row["name"],
                int(row["wager"]) or 1,
                int(row["payout"]),
                payload.get("lineWins", []),
                payload.get("scatter", {"count": 0, "payout": 0, "freeSpinsAwarded": 0}),
                bool(payload.get("usedFreeSpin", False)),
            ),
        }
        for row in rows
        for payload in [normalize_spin_storage(json_loads(row["symbols_json"], {}))]
    ]


def profile_payload(
    connection: sqlite3.Connection,
    row: sqlite3.Row,
    auth_config: AuthConfig | None = None,
    role_directory: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
    roles = user_roles(row)
    perks = []
    auth_config = auth_config or build_auth_config()
    role_directory = role_directory or {}
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
        "roleDetails": resolve_roles(roles, role_directory),
        "perks": perks,
        "isAdmin": bool(row["is_admin"]),
        "balance": get_balance(connection, row["id"]),
        "giveawayEntries": int(entries),
        "recentSpins": recent_spins(connection, row["id"], limit=3),
        "womLink": wom_link_payload(connection, int(row["id"])),
    }


def wom_clan_payload(connection: sqlite3.Connection, *, force_refresh: bool = False) -> dict[str, Any]:
    group_id = require_wom_group_id()
    group = wom_cached_json(connection, f"/groups/{group_id}", force_refresh=force_refresh)
    statistics = wom_cached_json(connection, f"/groups/{group_id}/statistics", force_refresh=force_refresh)
    achievements = wom_cached_json(
        connection,
        f"/groups/{group_id}/achievements",
        query={"limit": 6},
        force_refresh=force_refresh,
    )
    activity = wom_cached_json(
        connection,
        f"/groups/{group_id}/activity",
        query={"limit": 8},
        force_refresh=force_refresh,
    )
    hiscores = wom_cached_json(
        connection,
        f"/groups/{group_id}/hiscores",
        query={"metric": DEFAULT_WOM_HISCORE_METRIC, "limit": 5},
        force_refresh=force_refresh,
    )
    gains = wom_cached_json(
        connection,
        f"/groups/{group_id}/gained",
        query={"metric": DEFAULT_WOM_HISCORE_METRIC, "period": DEFAULT_WOM_PERIOD, "limit": 5},
        force_refresh=force_refresh,
    )
    return {
        "group": {
            "id": group.get("id"),
            "name": group.get("name"),
            "clanChat": group.get("clanChat"),
            "description": group.get("description"),
            "homeworld": group.get("homeworld"),
            "memberCount": group.get("memberCount"),
            "score": group.get("score"),
            "verified": group.get("verified"),
            "updatedAt": group.get("updatedAt"),
        },
        "statistics": {
            "maxedCombatCount": statistics.get("maxedCombatCount", 0),
            "maxedTotalCount": statistics.get("maxedTotalCount", 0),
            "maxed200msCount": statistics.get("maxed200msCount", 0),
            "averageOverallLevel": average_skill(statistics, "overall").get("level"),
            "averageOverallExperience": average_skill(statistics, "overall").get("experience"),
            "averageEhp": average_computed(statistics, "ehp").get("value"),
            "averageEhb": average_computed(statistics, "ehb").get("value"),
            "raw": statistics,
        },
        "linkCoverage": group_link_coverage(connection, group),
        "featuredHiscores": {
            "metric": DEFAULT_WOM_HISCORE_METRIC,
            "entries": normalize_group_hiscores(hiscores),
        },
        "featuredGains": {
            "metric": DEFAULT_WOM_HISCORE_METRIC,
            "period": DEFAULT_WOM_PERIOD,
            "entries": normalize_group_gains(gains),
        },
        "recentAchievements": normalize_achievements(achievements),
        "recentActivity": normalize_group_activity(activity),
    }


def wom_group_hiscores_payload(
    connection: sqlite3.Connection,
    *,
    metric: str = DEFAULT_WOM_HISCORE_METRIC,
    limit: int = 10,
    force_refresh: bool = False,
) -> dict[str, Any]:
    group_id = require_wom_group_id()
    entries = wom_cached_json(
        connection,
        f"/groups/{group_id}/hiscores",
        query={"metric": metric or DEFAULT_WOM_HISCORE_METRIC, "limit": max(1, min(limit, 50))},
        force_refresh=force_refresh,
    )
    return {
        "metric": metric or DEFAULT_WOM_HISCORE_METRIC,
        "entries": normalize_group_hiscores(entries),
    }


def wom_group_gains_payload(
    connection: sqlite3.Connection,
    *,
    metric: str = DEFAULT_WOM_HISCORE_METRIC,
    period: str = DEFAULT_WOM_PERIOD,
    limit: int = 10,
    force_refresh: bool = False,
) -> dict[str, Any]:
    group_id = require_wom_group_id()
    entries = wom_cached_json(
        connection,
        f"/groups/{group_id}/gained",
        query={"metric": metric or DEFAULT_WOM_HISCORE_METRIC, "period": period or DEFAULT_WOM_PERIOD, "limit": max(1, min(limit, 50))},
        force_refresh=force_refresh,
    )
    return {
        "metric": metric or DEFAULT_WOM_HISCORE_METRIC,
        "period": period or DEFAULT_WOM_PERIOD,
        "entries": normalize_group_gains(entries),
    }


def wom_me_payload(connection: sqlite3.Connection, user_row: sqlite3.Row, *, force_refresh: bool = False) -> dict[str, Any]:
    account = get_user_game_account(connection, int(user_row["id"]), "osrs")
    if not account:
        raise AppError("Link a Wise Old Man RuneScape account first.", 404)

    player = wom_cached_json(connection, f"/players/id/{int(account['wom_player_id'])}", force_refresh=force_refresh)
    username = str(player.get("username") or account["username"])
    save_user_game_account(connection, int(user_row["id"]), "osrs", player)
    gains = wom_cached_json(
        connection,
        f"/players/{quote(username)}/gained",
        query={"period": DEFAULT_WOM_PERIOD},
        force_refresh=force_refresh,
    )
    achievements = wom_cached_json(
        connection,
        f"/players/{quote(username)}/achievements",
        force_refresh=force_refresh,
    )
    standings = wom_cached_json(
        connection,
        f"/players/{quote(username)}/competitions/standings",
        query={"status": "ongoing"},
        force_refresh=force_refresh,
    )
    return {
        "player": {
            "id": player.get("id"),
            "username": player.get("username"),
            "displayName": player.get("displayName") or player.get("username"),
            "type": player.get("type"),
            "build": player.get("build"),
            "status": player.get("status"),
            "exp": player.get("exp"),
            "ehp": player.get("ehp"),
            "ehb": player.get("ehb"),
            "updatedAt": player.get("updatedAt"),
            "lastChangedAt": player.get("lastChangedAt"),
            "lastImportedAt": player.get("lastImportedAt"),
        },
        "gains": gains,
        "achievements": normalize_achievements(achievements),
        "competitions": [normalize_competition_item(entry) for entry in standings],
    }


def wom_competitions_payload(
    connection: sqlite3.Connection,
    *,
    limit: int = 12,
    force_refresh: bool = False,
) -> dict[str, Any]:
    group_id = require_wom_group_id()
    competitions = wom_cached_json(
        connection,
        f"/groups/{group_id}/competitions",
        query={"limit": max(1, min(limit, 25))},
        force_refresh=force_refresh,
    )
    return {
        "competitions": [normalize_competition_item(entry) for entry in competitions],
    }


def wom_competition_detail_payload(
    connection: sqlite3.Connection,
    competition_id: int,
    *,
    force_refresh: bool = False,
) -> dict[str, Any]:
    competition = wom_cached_json(
        connection,
        f"/competitions/{competition_id}",
        force_refresh=force_refresh,
    )
    top_history = wom_cached_json(
        connection,
        f"/competitions/{competition_id}/top-history",
        force_refresh=force_refresh,
    )
    return {
        "competition": {
            **normalize_competition_item(competition),
            "participants": normalize_competition_participants(competition.get("participants") or []),
        },
        "topHistory": normalize_competition_history(top_history),
    }


def refresh_wom_data(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    payload: dict[str, Any],
) -> dict[str, Any]:
    scope = str(payload.get("scope") or "all").strip().lower()
    deleted = 0
    refreshed: dict[str, Any] = {"scope": scope}

    if scope == "all":
        deleted += invalidate_wom_cache(connection)
        refreshed["clan"] = wom_clan_payload(connection, force_refresh=True)
        refreshed["competitions"] = wom_competitions_payload(connection, force_refresh=True)
    elif scope == "group":
        group_id = require_wom_group_id()
        deleted += invalidate_wom_cache(connection, f"groups/{group_id}")
        refreshed["clan"] = wom_clan_payload(connection, force_refresh=True)

    if scope == "player":
        username = str(payload.get("username") or "").strip()
        if not username:
            raise AppError("A Wise Old Man username is required to refresh player data.", 400)
        deleted += invalidate_wom_cache(connection, f"players/{quote(username)}")
        refreshed["player"] = {
            "player": wom_request_json(f"/players/{quote(username)}", method="POST"),
            "gains": wom_cached_json(connection, f"/players/{quote(username)}/gained", query={"period": DEFAULT_WOM_PERIOD}, force_refresh=True),
            "achievements": wom_cached_json(connection, f"/players/{quote(username)}/achievements", force_refresh=True),
        }

    if scope == "competition":
        competition_id = int(payload.get("competitionId") or 0)
        if competition_id:
            deleted += invalidate_wom_cache(connection, f"competitions/{competition_id}")
            refreshed["competition"] = wom_competition_detail_payload(connection, competition_id, force_refresh=True)
        else:
            raise AppError("A competitionId is required to refresh competition data.", 400)

    audit(
        connection,
        int(actor_row["id"]),
        "refresh_wom_cache",
        "wom_cache",
        scope,
        {"scope": scope, "deleted": deleted, "payload": payload},
    )
    connection.commit()
    return {"deleted": deleted, **refreshed}


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


def admin_overview(
    connection: sqlite3.Connection,
    role_directory: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
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
        "giveaways": list_giveaways(connection, role_directory=role_directory or {}),
        "wom": {
            "configured": wom_group_id() is not None,
            "linkedUsers": count_linked_game_accounts(connection, "osrs"),
        },
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

    def do_DELETE(self) -> None:
        connection = connect_database()
        try:
            prune_expired_sessions(connection)
            self.route_request("DELETE", connection)
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
        if method == "GET" and path == "/api/wom/clan":
            self.handle_api_wom_clan(connection)
            return
        if method == "GET" and path == "/api/wom/hiscores":
            self.handle_api_wom_hiscores(connection, parsed)
            return
        if method == "GET" and path == "/api/wom/gains":
            self.handle_api_wom_gains(connection, parsed)
            return
        if method == "GET" and path == "/api/wom/me":
            self.handle_api_wom_me(connection)
            return
        if method == "GET" and path == "/api/wom/competitions":
            self.handle_api_wom_competitions(connection, parsed)
            return
        if method == "GET" and path.startswith("/api/wom/competitions/"):
            self.handle_api_wom_competition_detail(connection, path)
            return
        if method == "GET" and path == "/api/rewards":
            self.handle_api_rewards(connection)
            return
        if method == "POST" and path == "/api/profile/wom-link":
            self.handle_api_wom_link(connection)
            return
        if method == "DELETE" and path == "/api/profile/wom-link":
            self.handle_api_wom_unlink(connection)
            return
        if method == "GET" and path == "/api/casino/games":
            user = self.current_user(connection)
            self.respond_json(
                {
                    "games": list_games(connection, user["id"] if user else None),
                    "dailyWagerCap": DAILY_WAGER_CAP,
                }
            )
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
            auth_config = build_auth_config(self.base_url())
            role_directory = build_role_directory(auth_config)
            self.respond_json(
                {
                    "overview": admin_overview(connection, role_directory=role_directory),
                    "actor": profile_payload(connection, actor, auth_config=auth_config, role_directory=role_directory),
                }
            )
            return
        if method == "GET" and path == "/api/admin/discord-roles":
            self.require_admin(connection)
            auth_config = build_auth_config(self.base_url())
            role_directory = build_role_directory(auth_config)
            self.respond_json(
                {
                    "roles": sorted_role_options(role_directory),
                    "guildSyncConfigured": auth_config.guild_ready,
                    "aliasCount": len(role_label_overrides()),
                }
            )
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
        if method == "POST" and path == "/api/admin/wom/refresh":
            actor = self.require_admin(connection)
            result = refresh_wom_data(connection, actor, self.read_json_body())
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
        if method == "GET" and path in {"/admin/editor", "/admin/editor/", "/admin/editor/index.html"}:
            self.redirect("/admin/")
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
                "womConfigured": wom_group_id() is not None,
                "womGroupId": wom_group_id(),
            }
        )

    def handle_api_me(self, connection: sqlite3.Connection) -> None:
        row = self.current_user(connection)
        if not row:
            self.respond_json({"authenticated": False})
            return
        auth_config = build_auth_config(self.base_url())
        role_directory = build_role_directory(auth_config)
        self.respond_json(
            {
                "authenticated": True,
                "user": profile_payload(connection, row, auth_config=auth_config, role_directory=role_directory),
            }
        )

    def handle_api_rewards(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        wager = daily_wager_status(connection, row["id"])
        self.respond_json(
            {
                "balance": get_balance(connection, row["id"]),
                "entries": recent_ledger(connection, row["id"]),
                "spins": recent_spins(connection, row["id"]),
                **wager,
            }
        )

    def handle_api_wom_clan(self, connection: sqlite3.Connection) -> None:
        self.respond_json(wom_clan_payload(connection))

    def handle_api_wom_hiscores(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        metric = params.get("metric", [DEFAULT_WOM_HISCORE_METRIC])[0]
        limit = int(params.get("limit", ["10"])[0] or 10)
        self.respond_json(wom_group_hiscores_payload(connection, metric=metric, limit=limit))

    def handle_api_wom_gains(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        metric = params.get("metric", [DEFAULT_WOM_HISCORE_METRIC])[0]
        period = params.get("period", [DEFAULT_WOM_PERIOD])[0]
        limit = int(params.get("limit", ["10"])[0] or 10)
        self.respond_json(wom_group_gains_payload(connection, metric=metric, period=period, limit=limit))

    def handle_api_wom_me(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        self.respond_json(wom_me_payload(connection, row))

    def handle_api_wom_competitions(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        limit = int(params.get("limit", ["12"])[0] or 12)
        self.respond_json(wom_competitions_payload(connection, limit=limit))

    def handle_api_wom_competition_detail(self, connection: sqlite3.Connection, path: str) -> None:
        competition_id = int(path.split("/")[-1])
        self.respond_json(wom_competition_detail_payload(connection, competition_id))

    def handle_api_wom_link(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        payload = self.read_json_body()
        result = link_wom_account(connection, row, str(payload.get("username") or ""))
        self.respond_json({"ok": True, "result": result}, status=201)

    def handle_api_wom_unlink(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        result = unlink_wom_account(connection, row)
        self.respond_json({"ok": True, "result": result})

    def handle_api_spin(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        payload = self.read_json_body()
        result = spin_game(connection, row, str(payload.get("gameSlug", "")).strip())
        self.respond_json({"ok": True, "result": result})

    def handle_api_giveaways(self, connection: sqlite3.Connection) -> None:
        row = self.current_user(connection)
        role_directory = build_role_directory(build_auth_config(self.base_url()))
        self.respond_json({"giveaways": list_giveaways(connection, row, role_directory=role_directory)})

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
        if path == "/site.js":
            return BASE_DIR / "site.js"
        if path in {"/design", "/design/"}:
            return BASE_DIR / "design" / "index.html"
        if path.startswith("/design/"):
            return (BASE_DIR / path.lstrip("/")).resolve()
        if path.startswith("/src/"):
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
