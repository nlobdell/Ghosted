from __future__ import annotations

import base64
import json
import html
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
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
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

COMPANION_SLOT_ORDER = ("hat", "face", "neck", "body")
COMPANION_SLOT_LABELS = {
    "hat": "Hat",
    "face": "Face",
    "neck": "Neck",
    "body": "Body",
}
COMPANION_LOADOUT_COLUMNS = {
    "hat": "hat_item_slug",
    "face": "face_item_slug",
    "neck": "neck_item_slug",
    "body": "body_item_slug",
}
COMPANION_CANVAS_SIZE = 32
COMPANION_ALLOWED_ASSET_EXTENSIONS = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}
COMPANION_MAX_UPLOAD_BYTES = 4 * 1024 * 1024
COMPANION_DEFAULT_BASE_ASSET_PATH = "defaults/base/ghostling-base.svg"


def pixel_rects(rects: list[tuple[int, int, int, int, str]]) -> str:
    return "".join(
        f'<rect x="{x}" y="{y}" width="{width}" height="{height}" fill="{fill}" />'
        for x, y, width, height, fill in rects
    )


COMPANION_BASE_MARKUP = pixel_rects(
    [
        (10, 7, 12, 1, "#07090d"),
        (8, 8, 16, 1, "#07090d"),
        (7, 9, 18, 14, "#07090d"),
        (8, 23, 16, 2, "#07090d"),
        (9, 25, 14, 2, "#07090d"),
        (10, 27, 12, 2, "#07090d"),
        (11, 8, 10, 1, "#39a7d7"),
        (9, 9, 14, 1, "#39a7d7"),
        (8, 10, 16, 5, "#39a7d7"),
        (8, 15, 16, 3, "#3397c7"),
        (9, 18, 14, 3, "#2e88b7"),
        (9, 21, 14, 2, "#2777a1"),
        (10, 23, 12, 2, "#2e88b7"),
        (11, 25, 10, 2, "#3397c7"),
        (12, 27, 8, 1, "#39a7d7"),
        (13, 11, 2, 4, "#f4fbff"),
        (18, 11, 2, 4, "#f4fbff"),
        (14, 12, 1, 2, "#0d1622"),
        (19, 12, 1, 2, "#0d1622"),
        (15, 17, 2, 1, "#7fc9ec"),
        (14, 18, 1, 1, "#7fc9ec"),
        (17, 18, 1, 1, "#7fc9ec"),
    ]
)

COMPANION_ITEMS = [
    {
        "slug": "witch-hat",
        "name": "Witch Hat",
        "slot": "hat",
        "rarity": "rare",
        "cost": 120,
        "description": "A crooked brim for maximum spooky little gremlin energy.",
        "sort_order": 10,
        "front_markup": pixel_rects(
            [
                (9, 3, 8, 1, "#3d255b"),
                (10, 2, 6, 1, "#3d255b"),
                (11, 1, 4, 1, "#3d255b"),
                (7, 4, 14, 2, "#20112f"),
                (13, 3, 2, 1, "#f6a94a"),
            ]
        ),
    },
    {
        "slug": "halo",
        "name": "Halo",
        "slot": "hat",
        "rarity": "epic",
        "cost": 220,
        "description": "Bright, smug, and a little too clean for a ghost.",
        "sort_order": 20,
        "front_markup": pixel_rects(
            [
                (9, 3, 10, 1, "#f6d36a"),
                (8, 4, 12, 1, "#f6d36a"),
                (9, 5, 10, 1, "#fff0b5"),
            ]
        ),
    },
    {
        "slug": "traffic-cone",
        "name": "Traffic Cone",
        "slot": "hat",
        "rarity": "common",
        "cost": 80,
        "description": "Street-certified nonsense for the tiny haunt economy.",
        "sort_order": 30,
        "front_markup": pixel_rects(
            [
                (13, 1, 2, 1, "#ff7e2f"),
                (12, 2, 4, 1, "#ff7e2f"),
                (11, 3, 6, 2, "#ff7e2f"),
                (12, 3, 4, 1, "#fff1e2"),
                (10, 5, 8, 2, "#bd5116"),
            ]
        ),
    },
    {
        "slug": "sleepy-eyes",
        "name": "Sleepy Eyes",
        "slot": "face",
        "rarity": "common",
        "cost": 60,
        "description": "A half-awake stare for late-night lurkers.",
        "sort_order": 40,
        "front_markup": pixel_rects(
            [
                (12, 12, 3, 1, "#1f2b38"),
                (18, 12, 3, 1, "#1f2b38"),
            ]
        ),
    },
    {
        "slug": "fang-smile",
        "name": "Fang Smile",
        "slot": "face",
        "rarity": "rare",
        "cost": 95,
        "description": "Tiny fangs, huge menace, surprisingly approachable.",
        "sort_order": 50,
        "front_markup": pixel_rects(
            [
                (14, 17, 5, 1, "#1f2b38"),
                (15, 18, 1, 1, "#ffffff"),
                (17, 18, 1, 1, "#ffffff"),
            ]
        ),
    },
    {
        "slug": "cracked-mask",
        "name": "Cracked Mask",
        "slot": "face",
        "rarity": "epic",
        "cost": 180,
        "description": "A porcelain front with a dramatic fault line.",
        "sort_order": 60,
        "front_markup": pixel_rects(
            [
                (11, 11, 10, 6, "#f3ece1"),
                (12, 12, 8, 4, "#fff9f0"),
                (15, 11, 1, 6, "#a58b81"),
                (13, 13, 1, 1, "#90776d"),
                (18, 13, 1, 1, "#90776d"),
            ]
        ),
    },
    {
        "slug": "bell-collar",
        "name": "Bell Collar",
        "slot": "neck",
        "rarity": "common",
        "cost": 70,
        "description": "A happy jingle before the jump scare.",
        "sort_order": 70,
        "front_markup": pixel_rects(
            [
                (11, 20, 10, 2, "#f3bb5d"),
                (14, 22, 4, 3, "#f8d16d"),
                (15, 24, 1, 1, "#7d5410"),
            ]
        ),
    },
    {
        "slug": "tattered-scarf",
        "name": "Tattered Scarf",
        "slot": "neck",
        "rarity": "rare",
        "cost": 110,
        "description": "Wind-cut fabric with a little travel story in it.",
        "sort_order": 80,
        "front_markup": pixel_rects(
            [
                (10, 20, 12, 3, "#5e7fd6"),
                (12, 23, 2, 5, "#4256b8"),
                (18, 23, 2, 4, "#4256b8"),
            ]
        ),
    },
    {
        "slug": "lantern-charm",
        "name": "Lantern Charm",
        "slot": "neck",
        "rarity": "epic",
        "cost": 175,
        "description": "A warm hanging lantern that reads well in tiny previews.",
        "sort_order": 90,
        "front_markup": pixel_rects(
            [
                (15, 19, 2, 2, "#7a5c39"),
                (13, 21, 6, 4, "#f7b45a"),
                (14, 22, 4, 2, "#fff0b0"),
            ]
        ),
    },
    {
        "slug": "hoodie",
        "name": "Hoodie",
        "slot": "body",
        "rarity": "common",
        "cost": 130,
        "description": "Comfy ghostwear for grinding, lurking, or posting.",
        "sort_order": 100,
        "front_markup": pixel_rects(
            [
                (10, 17, 12, 10, "#536882"),
                (11, 18, 10, 3, "#32435d"),
                (13, 21, 2, 6, "#32435d"),
                (17, 21, 2, 6, "#32435d"),
            ]
        ),
    },
    {
        "slug": "cape",
        "name": "Cape",
        "slot": "body",
        "rarity": "rare",
        "cost": 190,
        "description": "A dramatic cape that turns a peeker into a tiny entrance.",
        "sort_order": 110,
        "back_markup": pixel_rects(
            [
                (8, 16, 16, 8, "#5d2b7d"),
                (9, 24, 14, 4, "#4b215f"),
            ]
        ),
        "front_markup": pixel_rects(
            [
                (11, 18, 10, 8, "#9a52b8"),
                (18, 18, 3, 7, "#af69c8"),
            ]
        ),
    },
    {
        "slug": "bat-wings",
        "name": "Bat Wings",
        "slot": "body",
        "rarity": "legendary",
        "cost": 320,
        "description": "Big silhouette value for people who want their companion noticed.",
        "sort_order": 120,
        "back_markup": pixel_rects(
            [
                (3, 16, 6, 1, "#2d243e"),
                (2, 17, 7, 2, "#2d243e"),
                (1, 19, 8, 3, "#2d243e"),
                (23, 16, 6, 1, "#2d243e"),
                (23, 17, 7, 2, "#2d243e"),
                (23, 19, 8, 3, "#2d243e"),
            ]
        ),
        "front_markup": pixel_rects(
            [
                (10, 18, 12, 7, "#3d3153"),
            ]
        ),
    },
]
COMPANION_ITEM_BY_SLUG = {item["slug"]: item for item in COMPANION_ITEMS}


def pixel_sprite_svg(markup: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" '
        'shape-rendering="crispEdges" style="image-rendering:pixelated">'
        f"{markup}"
        "</svg>"
    )


def companion_asset_dir() -> Path:
    configured = os.getenv("COMPANION_ASSET_DIR")
    if configured:
        return Path(configured).expanduser()
    return DB_DIR / "companion-assets"


def normalize_companion_asset_path(value: str) -> str:
    candidate = Path(str(value or "").strip().replace("\\", "/"))
    if candidate.is_absolute():
        raise AppError("Invalid companion asset path.", 400)

    parts = [part for part in candidate.parts if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        raise AppError("Invalid companion asset path.", 400)
    return Path(*parts).as_posix()


def companion_asset_path(relative_path: str) -> Path:
    root = companion_asset_dir().resolve()
    normalized = normalize_companion_asset_path(relative_path)
    target = (root / normalized).resolve()
    if root not in target.parents and target != root:
        raise AppError("Companion asset not found.", 404)
    return target


def write_companion_asset_file(relative_path: str, data: bytes) -> str:
    target = companion_asset_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return normalize_companion_asset_path(relative_path)


def write_default_companion_asset(relative_path: str, content: str) -> str:
    target = companion_asset_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_text(content, encoding="utf-8")
    return normalize_companion_asset_path(relative_path)


def default_companion_front_asset_path(slug: str) -> str:
    return f"defaults/items/{slug}-front.svg"


def default_companion_back_asset_path(slug: str) -> str:
    return f"defaults/items/{slug}-back.svg"


def ensure_default_companion_assets() -> None:
    write_default_companion_asset(COMPANION_DEFAULT_BASE_ASSET_PATH, pixel_sprite_svg(COMPANION_BASE_MARKUP))

    for item in COMPANION_ITEMS:
        front_markup = str(item.get("front_markup") or "").strip()
        if front_markup:
            write_default_companion_asset(
                default_companion_front_asset_path(str(item["slug"])),
                pixel_sprite_svg(front_markup),
            )

        back_markup = str(item.get("back_markup") or "").strip()
        if back_markup:
            write_default_companion_asset(
                default_companion_back_asset_path(str(item["slug"])),
                pixel_sprite_svg(back_markup),
            )


def companion_asset_url(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    normalized = normalize_companion_asset_path(relative_path)
    encoded_parts = [quote(part) for part in normalized.split("/")]
    return f"/api/companion/assets/{'/'.join(encoded_parts)}"


def companion_asset_data_uri(relative_path: str | None) -> str | None:
    if not relative_path:
        return None

    target = companion_asset_path(relative_path)
    if not target.exists() or not target.is_file():
        return None

    mime = COMPANION_ALLOWED_ASSET_EXTENSIONS.get(target.suffix.lower())
    if not mime:
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(target.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def companion_layer_image(relative_path: str | None) -> str:
    data_uri = companion_asset_data_uri(relative_path)
    if not data_uri:
        return ""
    return (
        f'<image href="{data_uri}" x="0" y="0" width="{COMPANION_CANVAS_SIZE}" '
        f'height="{COMPANION_CANVAS_SIZE}" preserveAspectRatio="none" />'
    )


def parse_header_parameters(header_value: str) -> tuple[str, dict[str, str]]:
    parts = [segment.strip() for segment in str(header_value or "").split(";") if segment.strip()]
    if not parts:
        return "", {}

    params: dict[str, str] = {}
    for part in parts[1:]:
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        params[key.strip().lower()] = value.strip().strip('"')
    return parts[0].lower(), params


@dataclass
class UploadedFile:
    filename: str
    content_type: str
    data: bytes


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


def humanize_identifier(value: Any) -> str:
    text = str(value or "").strip().replace("_", " ").replace("-", " ")
    if not text:
        return ""
    return " ".join(part.capitalize() for part in text.split())


def normalize_wom_membership(group_id: int | None, memberships: list[dict[str, Any]]) -> dict[str, Any] | None:
    if group_id is None:
        return None

    target = str(group_id)
    for membership in memberships:
        group = membership.get("group") or {}
        membership_group_id = membership.get("groupId", group.get("id"))
        if str(membership_group_id) != target:
            continue

        role = membership.get("role")
        role_name = ""
        rank_order: int | None = None
        if isinstance(role, dict):
            role_name = (
                str(role.get("name") or role.get("label") or role.get("title") or role.get("role") or "").strip()
            )
            raw_rank_order = role.get("order", role.get("rankOrder", role.get("rank", role.get("id"))))
            try:
                rank_order = int(raw_rank_order) if raw_rank_order not in (None, "") else None
            except (TypeError, ValueError):
                rank_order = None
        elif role not in (None, ""):
            role_name = str(role).strip()

        raw_rank_label = (
            membership.get("rankLabel")
            or membership.get("roleName")
            or membership.get("title")
            or membership.get("rank")
            or role_name
        )
        rank_label = humanize_identifier(raw_rank_label)
        raw_membership_rank = membership.get("rankOrder", membership.get("rankId"))
        if rank_order is None:
            try:
                rank_order = int(raw_membership_rank) if raw_membership_rank not in (None, "") else None
            except (TypeError, ValueError):
                rank_order = None

        return {
            "groupId": int(group.get("id") or membership_group_id),
            "groupName": str(group.get("name") or group.get("groupName") or "Ghosted").strip() or "Ghosted",
            "role": rank_label or humanize_identifier(role_name) or "Member",
            "rankLabel": rank_label or humanize_identifier(role_name) or "Member",
            "rankOrder": rank_order,
            "raw": membership,
        }
    return None


def wom_membership_payload(
    connection: sqlite3.Connection,
    account: sqlite3.Row,
    *,
    force_refresh: bool = False,
) -> dict[str, Any] | None:
    group_id = wom_group_id()
    if group_id is None:
        return None

    memberships = wom_cached_json(
        connection,
        f"/players/{quote(str(account['username']))}/groups",
        force_refresh=force_refresh,
    )
    return normalize_wom_membership(group_id, memberships if isinstance(memberships, list) else [])


def wom_link_payload(connection: sqlite3.Connection, user_id: int) -> dict[str, Any]:
    account = get_user_game_account(connection, user_id, "osrs")
    if not account:
        return {
            "linked": False,
            "playerId": None,
            "username": None,
            "displayName": None,
            "inGroup": False,
            "membership": None,
            "lastSyncedAt": None,
            "status": "unlinked",
        }

    membership = None
    if wom_group_id() is not None:
        try:
            membership = wom_membership_payload(connection, account)
        except AppError:
            membership = None

    return {
        "linked": True,
        "playerId": int(account["wom_player_id"]),
        "username": account["username"],
        "displayName": account["display_name"],
        "inGroup": bool(membership) if wom_group_id() is not None else True,
        "membership": membership,
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
        data = entry.get("data") or {}
        normalized.append(
            {
                "rank": index,
                "player": {
                    "id": player.get("id"),
                    "username": player.get("username"),
                    "displayName": player.get("displayName") or player.get("username"),
                },
                "gained": data.get("gained", entry.get("gained", 0)),
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


def table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row["name"]) for row in rows}


def ensure_table_column(connection: sqlite3.Connection, table_name: str, column_name: str, definition: str) -> None:
    if column_name in table_columns(connection, table_name):
        return
    connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


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

        CREATE TABLE IF NOT EXISTS news_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            excerpt TEXT NOT NULL,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            published_at TEXT,
            created_by_user_id INTEGER REFERENCES users(id),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
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

        CREATE TABLE IF NOT EXISTS companion_catalog (
            slug TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slot_key TEXT NOT NULL,
            rarity TEXT NOT NULL,
            cost INTEGER NOT NULL DEFAULT 0,
            description TEXT NOT NULL,
            front_asset_path TEXT,
            back_asset_path TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_companion_inventory (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            item_slug TEXT NOT NULL REFERENCES companion_catalog(slug) ON DELETE CASCADE,
            unlocked_at TEXT NOT NULL,
            PRIMARY KEY (user_id, item_slug)
        );

        CREATE TABLE IF NOT EXISTS user_companion_loadout (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            hat_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
            face_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
            neck_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
            body_item_slug TEXT REFERENCES companion_catalog(slug) ON DELETE SET NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS companion_settings (
            singleton_key TEXT PRIMARY KEY,
            base_asset_path TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    ensure_table_column(connection, "companion_catalog", "front_asset_path", "TEXT")
    ensure_table_column(connection, "companion_catalog", "back_asset_path", "TEXT")
    seed_default_games(connection)
    seed_default_giveaway(connection)
    seed_default_companion_items(connection)
    ensure_default_companion_base(connection)
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


def ensure_default_companion_base(connection: sqlite3.Connection) -> None:
    ensure_default_companion_assets()
    existing = connection.execute(
        "SELECT base_asset_path FROM companion_settings WHERE singleton_key = 'default'",
    ).fetchone()
    if existing:
        if not existing["base_asset_path"]:
            connection.execute(
                "UPDATE companion_settings SET base_asset_path = ?, updated_at = ? WHERE singleton_key = 'default'",
                (COMPANION_DEFAULT_BASE_ASSET_PATH, utc_iso()),
            )
        return

    connection.execute(
        """
        INSERT INTO companion_settings (singleton_key, base_asset_path, updated_at)
        VALUES ('default', ?, ?)
        """,
        (COMPANION_DEFAULT_BASE_ASSET_PATH, utc_iso()),
    )


def seed_default_companion_items(connection: sqlite3.Connection) -> None:
    ensure_default_companion_assets()
    created_at = utc_iso()
    for item in COMPANION_ITEMS:
        front_asset_path = default_companion_front_asset_path(str(item["slug"])) if item.get("front_markup") else None
        back_asset_path = default_companion_back_asset_path(str(item["slug"])) if item.get("back_markup") else None
        connection.execute(
            """
            INSERT INTO companion_catalog (
                slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, active, sort_order, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                name = excluded.name,
                slot_key = excluded.slot_key,
                rarity = excluded.rarity,
                cost = excluded.cost,
                description = excluded.description,
                front_asset_path = COALESCE(companion_catalog.front_asset_path, excluded.front_asset_path),
                back_asset_path = COALESCE(companion_catalog.back_asset_path, excluded.back_asset_path),
                active = excluded.active,
                sort_order = excluded.sort_order
            """,
            (
                item["slug"],
                item["name"],
                item["slot"],
                item["rarity"],
                item["cost"],
                item["description"],
                front_asset_path,
                back_asset_path,
                item["sort_order"],
                created_at,
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


def ensure_user_companion_loadout(connection: sqlite3.Connection, user_id: int) -> None:
    connection.execute(
        """
        INSERT OR IGNORE INTO user_companion_loadout (
            user_id, hat_item_slug, face_item_slug, neck_item_slug, body_item_slug, updated_at
        )
        VALUES (?, NULL, NULL, NULL, NULL, ?)
        """,
        (user_id, utc_iso()),
    )


def companion_inventory_slugs(connection: sqlite3.Connection, user_id: int) -> set[str]:
    rows = connection.execute(
        "SELECT item_slug FROM user_companion_inventory WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    return {str(row["item_slug"]) for row in rows}


def companion_catalog_row(connection: sqlite3.Connection, slug: str) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM companion_catalog WHERE slug = ? AND active = 1",
        (slug,),
    ).fetchone()


def companion_catalog_any_row(connection: sqlite3.Connection, slug: str) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM companion_catalog WHERE slug = ?",
        (slug,),
    ).fetchone()


def companion_catalog_rows(connection: sqlite3.Connection, *, active_only: bool = True) -> list[sqlite3.Row]:
    query = """
        SELECT slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, active, sort_order, created_at
        FROM companion_catalog
    """
    if active_only:
        query += " WHERE active = 1"
    query += " ORDER BY slot_key ASC, sort_order ASC, name ASC"
    return connection.execute(query).fetchall()


def companion_catalog_map(connection: sqlite3.Connection, *, active_only: bool = False) -> dict[str, sqlite3.Row]:
    return {
        str(row["slug"]): row
        for row in companion_catalog_rows(connection, active_only=active_only)
    }


def companion_base_asset_path(connection: sqlite3.Connection) -> str:
    ensure_default_companion_base(connection)
    row = connection.execute(
        "SELECT base_asset_path FROM companion_settings WHERE singleton_key = 'default'",
    ).fetchone()
    value = str(row["base_asset_path"] or "").strip() if row else ""
    if value:
        try:
            if companion_asset_path(value).exists():
                return value
        except AppError:
            pass
    return COMPANION_DEFAULT_BASE_ASSET_PATH


def next_companion_sort_order(connection: sqlite3.Connection, slot_key: str) -> int:
    row = connection.execute(
        "SELECT COALESCE(MAX(sort_order), 0) AS value FROM companion_catalog WHERE slot_key = ?",
        (slot_key,),
    ).fetchone()
    return int(row["value"] or 0) + 10


def store_uploaded_companion_asset(upload: UploadedFile, *, group: str, stem: str) -> str:
    filename = Path(upload.filename or "").name
    extension = Path(filename).suffix.lower()
    if extension not in COMPANION_ALLOWED_ASSET_EXTENSIONS:
        raise AppError("Upload a PNG, SVG, WEBP, JPG, or JPEG companion asset.", 400)
    if not upload.data:
        raise AppError("Uploaded companion asset was empty.", 400)
    if len(upload.data) > COMPANION_MAX_UPLOAD_BYTES:
        raise AppError("Companion asset uploads are capped at 4 MB.", 400)

    safe_stem = slugify(stem or Path(filename).stem or "companion-asset")
    unique_name = f"{safe_stem}-{secrets.token_hex(4)}{extension}"
    return write_companion_asset_file(f"uploads/{group}/{unique_name}", upload.data)


def companion_admin_payload(connection: sqlite3.Connection) -> dict[str, Any]:
    rows = companion_catalog_rows(connection, active_only=False)
    base_path = companion_base_asset_path(connection)
    return {
        "storageRoot": str(companion_asset_dir()),
        "base": {
            "assetPath": base_path,
            "assetUrl": companion_asset_url(base_path),
            "previewUrl": "/api/companion/render",
        },
        "items": [
            {
                "slug": row["slug"],
                "name": row["name"],
                "slot": row["slot_key"],
                "rarity": row["rarity"],
                "cost": int(row["cost"]),
                "description": row["description"],
                "active": bool(row["active"]),
                "frontAssetPath": row["front_asset_path"],
                "frontAssetUrl": companion_asset_url(row["front_asset_path"]),
                "backAssetPath": row["back_asset_path"],
                "backAssetUrl": companion_asset_url(row["back_asset_path"]),
                "previewUrl": f"/api/companion/render?preview={quote(str(row['slug']))}",
            }
            for row in rows
        ],
    }


def companion_loadout_map(connection: sqlite3.Connection, user_id: int) -> dict[str, str | None]:
    ensure_user_companion_loadout(connection, user_id)
    row = connection.execute(
        "SELECT * FROM user_companion_loadout WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return {
        slot: (row[COMPANION_LOADOUT_COLUMNS[slot]] if row else None)
        for slot in COMPANION_SLOT_ORDER
    }


def companion_slot_options(
    catalog_rows: list[sqlite3.Row],
    owned_slugs: set[str],
    slot: str,
) -> list[dict[str, Any]]:
    return [
        {
            "slug": row["slug"],
            "name": row["name"],
            "rarity": row["rarity"],
            "cost": int(row["cost"]),
        }
        for row in catalog_rows
        if row["slot_key"] == slot and row["slug"] in owned_slugs
    ]


def companion_payload(
    connection: sqlite3.Connection,
    user_row: sqlite3.Row,
) -> dict[str, Any]:
    catalog_rows = companion_catalog_rows(connection)
    owned_slugs = companion_inventory_slugs(connection, int(user_row["id"]))
    loadout = companion_loadout_map(connection, int(user_row["id"]))

    items = [
        {
            "slug": row["slug"],
            "name": row["name"],
            "slot": row["slot_key"],
            "slotLabel": COMPANION_SLOT_LABELS.get(row["slot_key"], row["slot_key"].title()),
            "rarity": row["rarity"],
            "cost": int(row["cost"]),
            "description": row["description"],
            "owned": row["slug"] in owned_slugs,
            "equipped": loadout.get(row["slot_key"]) == row["slug"],
            "previewUrl": f"/api/companion/render?preview={quote(str(row['slug']))}",
            "frontAssetUrl": companion_asset_url(row["front_asset_path"]),
            "backAssetUrl": companion_asset_url(row["back_asset_path"]),
        }
        for row in catalog_rows
    ]

    slots = [
        {
            "key": slot,
            "label": COMPANION_SLOT_LABELS[slot],
            "equippedSlug": loadout.get(slot),
            "ownedOptions": companion_slot_options(catalog_rows, owned_slugs, slot),
        }
        for slot in COMPANION_SLOT_ORDER
    ]

    equipped_count = sum(1 for slot in COMPANION_SLOT_ORDER if loadout.get(slot))
    return {
        "user": {
            "id": int(user_row["id"]),
            "displayName": display_name(user_row),
            "username": user_row["username"],
        },
        "balance": get_balance(connection, int(user_row["id"])),
        "ownedCount": len(owned_slugs),
        "equippedCount": equipped_count,
        "loadout": loadout,
        "slots": slots,
        "items": items,
        "renderUrl": f"/api/companion/render?user={int(user_row['id'])}",
        "cardUrl": f"/api/companion/render?user={int(user_row['id'])}&card=1",
        "share": {
            "avatarUrl": f"/api/companion/render?user={int(user_row['id'])}",
            "cardUrl": f"/api/companion/render?user={int(user_row['id'])}&card=1",
        },
        "baseAssetUrl": companion_asset_url(companion_base_asset_path(connection)),
    }


def purchase_companion_item(
    connection: sqlite3.Connection,
    user_row: sqlite3.Row,
    slug: str,
) -> dict[str, Any]:
    item = companion_catalog_row(connection, slug)
    if not item:
        raise AppError("That companion item does not exist.", 404)

    user_id = int(user_row["id"])
    owned_slugs = companion_inventory_slugs(connection, user_id)
    if slug in owned_slugs:
        raise AppError("You already unlocked that companion cosmetic.", 400)

    balance = get_balance(connection, user_id)
    cost = int(item["cost"])
    if balance < cost:
        raise AppError("You do not have enough points to unlock that cosmetic.", 400)

    if cost > 0:
        append_ledger(
            connection,
            user_id,
            -cost,
            "companion_purchase",
            f"Unlocked companion cosmetic: {item['name']}.",
            {"item_slug": slug, "slot": item["slot_key"], "cost": cost},
        )

    connection.execute(
        "INSERT INTO user_companion_inventory (user_id, item_slug, unlocked_at) VALUES (?, ?, ?)",
        (user_id, slug, utc_iso()),
    )

    ensure_user_companion_loadout(connection, user_id)
    column = COMPANION_LOADOUT_COLUMNS[str(item["slot_key"])]
    current = connection.execute(
        f"SELECT {column} FROM user_companion_loadout WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if current and not current[column]:
        connection.execute(
            f"UPDATE user_companion_loadout SET {column} = ?, updated_at = ? WHERE user_id = ?",
            (slug, utc_iso(), user_id),
        )

    connection.commit()
    return companion_payload(connection, user_row)


def equip_companion_item(
    connection: sqlite3.Connection,
    user_row: sqlite3.Row,
    slot: str,
    slug: str | None,
) -> dict[str, Any]:
    normalized_slot = str(slot or "").strip().lower()
    if normalized_slot not in COMPANION_SLOT_ORDER:
        raise AppError("That companion slot is invalid.", 400)

    user_id = int(user_row["id"])
    ensure_user_companion_loadout(connection, user_id)
    value: str | None = None

    if slug:
        item = companion_catalog_row(connection, slug)
        if not item:
            raise AppError("That companion item does not exist.", 404)
        if item["slot_key"] != normalized_slot:
            raise AppError("That cosmetic does not fit the selected slot.", 400)
        if slug not in companion_inventory_slugs(connection, user_id):
            raise AppError("Unlock the cosmetic before equipping it.", 400)
        value = slug

    column = COMPANION_LOADOUT_COLUMNS[normalized_slot]
    connection.execute(
        f"UPDATE user_companion_loadout SET {column} = ?, updated_at = ? WHERE user_id = ?",
        (value, utc_iso(), user_id),
    )
    connection.commit()
    return companion_payload(connection, user_row)


def upload_companion_base_asset(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    asset: UploadedFile,
) -> dict[str, Any]:
    asset_path = store_uploaded_companion_asset(asset, group="base", stem="ghostling-base")
    connection.execute(
        """
        INSERT INTO companion_settings (singleton_key, base_asset_path, updated_at)
        VALUES ('default', ?, ?)
        ON CONFLICT(singleton_key) DO UPDATE SET
            base_asset_path = excluded.base_asset_path,
            updated_at = excluded.updated_at
        """,
        (asset_path, utc_iso()),
    )
    audit(
        connection,
        int(actor_row["id"]),
        "upload_companion_base_asset",
        "companion_settings",
        "default",
        {"assetPath": asset_path},
    )
    connection.commit()
    return companion_admin_payload(connection)


def create_companion_item(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    *,
    name: str,
    slug: str | None,
    slot: str,
    rarity: str,
    cost: int,
    description: str,
    front_asset: UploadedFile,
    back_asset: UploadedFile | None = None,
) -> dict[str, Any]:
    normalized_slot = str(slot or "").strip().lower()
    if normalized_slot not in COMPANION_SLOT_ORDER:
        raise AppError("Pick a valid companion slot for the cosmetic.", 400)

    normalized_name = str(name or "").strip()
    if not normalized_name:
        raise AppError("A cosmetic name is required.", 400)

    normalized_slug = slugify(slug or normalized_name)
    if companion_catalog_any_row(connection, normalized_slug):
        raise AppError("That cosmetic slug already exists.", 409)

    normalized_rarity = str(rarity or "").strip().lower() or "common"
    if normalized_rarity not in {"common", "rare", "epic", "legendary"}:
        raise AppError("Choose a rarity of common, rare, epic, or legendary.", 400)
    normalized_description = str(description or "").strip() or "Custom uploaded companion cosmetic."
    if cost < 0:
        raise AppError("Companion cosmetic cost cannot be negative.", 400)

    front_asset_path = store_uploaded_companion_asset(front_asset, group="items", stem=f"{normalized_slug}-front")
    back_asset_path = (
        store_uploaded_companion_asset(back_asset, group="items", stem=f"{normalized_slug}-back")
        if back_asset and back_asset.data
        else None
    )
    created_at = utc_iso()
    connection.execute(
        """
        INSERT INTO companion_catalog (
            slug, name, slot_key, rarity, cost, description, front_asset_path, back_asset_path, active, sort_order, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            normalized_slug,
            normalized_name,
            normalized_slot,
            normalized_rarity,
            cost,
            normalized_description,
            front_asset_path,
            back_asset_path,
            next_companion_sort_order(connection, normalized_slot),
            created_at,
        ),
    )
    audit(
        connection,
        int(actor_row["id"]),
        "create_companion_item",
        "companion_catalog",
        normalized_slug,
        {"slot": normalized_slot, "frontAssetPath": front_asset_path, "backAssetPath": back_asset_path},
    )
    connection.commit()
    return companion_admin_payload(connection)


def replace_companion_item_assets(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    slug: str,
    *,
    front_asset: UploadedFile | None = None,
    back_asset: UploadedFile | None = None,
) -> dict[str, Any]:
    item = companion_catalog_any_row(connection, slug)
    if not item:
        raise AppError("That companion cosmetic does not exist.", 404)
    if not front_asset and not back_asset:
        raise AppError("Upload at least one asset file to replace.", 400)

    next_front_asset_path = item["front_asset_path"]
    next_back_asset_path = item["back_asset_path"]
    if front_asset and front_asset.data:
        next_front_asset_path = store_uploaded_companion_asset(front_asset, group="items", stem=f"{slug}-front")
    if back_asset and back_asset.data:
        next_back_asset_path = store_uploaded_companion_asset(back_asset, group="items", stem=f"{slug}-back")

    connection.execute(
        """
        UPDATE companion_catalog
        SET front_asset_path = ?, back_asset_path = ?
        WHERE slug = ?
        """,
        (next_front_asset_path, next_back_asset_path, slug),
    )
    audit(
        connection,
        int(actor_row["id"]),
        "replace_companion_item_assets",
        "companion_catalog",
        slug,
        {"frontAssetPath": next_front_asset_path, "backAssetPath": next_back_asset_path},
    )
    connection.commit()
    return companion_admin_payload(connection)


def resolve_companion_layers(connection: sqlite3.Connection, loadout: dict[str, str | None]) -> list[str]:
    layers: list[str] = []
    catalog = companion_catalog_map(connection)
    body_slug = loadout.get("body")
    body_item = catalog.get(body_slug or "")
    if body_item:
        layers.append(companion_layer_image(body_item["back_asset_path"]))

    layers.append(companion_layer_image(companion_base_asset_path(connection)))

    for slot in ("neck", "face", "hat"):
        item = catalog.get(loadout.get(slot) or "")
        if item:
            layers.append(companion_layer_image(item["front_asset_path"]))

    if body_item:
        layers.append(companion_layer_image(body_item["front_asset_path"]))

    return [layer for layer in layers if layer]


def render_companion_svg(
    connection: sqlite3.Connection,
    loadout: dict[str, str | None],
    *,
    display_name: str,
    subtitle: str | None = None,
    card: bool = False,
) -> str:
    layers = "".join(resolve_companion_layers(connection, loadout))

    if card:
        title = html.escape(display_name)
        subtitle_text = html.escape(subtitle or "Ghosted Companion")
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" '
            'shape-rendering="crispEdges" style="image-rendering:pixelated">'
            "<defs>"
            '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0%" stop-color="#0b0a11" />'
            '<stop offset="100%" stop-color="#1b1730" />'
            "</linearGradient>"
            "</defs>"
            '<rect width="480" height="320" rx="28" fill="url(#bg)" />'
            '<rect x="24" y="24" width="190" height="272" rx="22" fill="#090b11" stroke="#2b3552" />'
            '<rect x="40" y="40" width="158" height="240" rx="18" fill="#0e1320" />'
            '<g transform="translate(47 53) scale(4.8)">'
            f"{layers}"
            "</g>"
            '<text x="244" y="106" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">GHOSTED COMPANION</text>'
            f'<text x="244" y="152" fill="#f7f6ff" font-family="Arial, sans-serif" font-size="28" font-weight="700">{title}</text>'
            f'<text x="244" y="184" fill="#b8b0d5" font-family="Arial, sans-serif" font-size="16">{subtitle_text}</text>'
            '<text x="244" y="226" fill="#d9d4ef" font-family="Arial, sans-serif" font-size="15">Spend points, unlock cosmetics, and share your tiny ghost anywhere Ghosted shows up.</text>'
            '<rect x="244" y="250" width="170" height="34" rx="17" fill="#16132a" stroke="#312759" />'
            '<text x="262" y="271" fill="#9bb6ff" font-family="Arial, sans-serif" font-size="14">discord-ready share card</text>'
            "</svg>"
        )

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 32 32" '
        'shape-rendering="crispEdges" style="image-rendering:pixelated">'
        f"{layers}"
        "</svg>"
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


def news_visibility_clause(include_drafts: bool) -> tuple[str, tuple[Any, ...]]:
    if include_drafts:
        return "", ()
    return "WHERE news_posts.status = 'published' AND (news_posts.published_at IS NULL OR news_posts.published_at <= ?)", (utc_iso(),)


def list_news_posts(
    connection: sqlite3.Connection,
    *,
    include_drafts: bool = False,
    limit: int = 12,
) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 50))
    where_clause, where_args = news_visibility_clause(include_drafts)
    rows = connection.execute(
        f"""
        SELECT
            news_posts.*,
            users.username AS author_username,
            users.global_name AS author_global_name
        FROM news_posts
        LEFT JOIN users ON users.id = news_posts.created_by_user_id
        {where_clause}
        ORDER BY COALESCE(news_posts.published_at, news_posts.created_at) DESC, news_posts.id DESC
        LIMIT ?
        """,
        (*where_args, safe_limit),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "slug": row["slug"],
            "title": row["title"],
            "excerpt": row["excerpt"],
            "body": row["body"],
            "status": row["status"],
            "publishedAt": row["published_at"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "authorDisplayName": row["author_global_name"] or row["author_username"] or "Ghosted",
        }
        for row in rows
    ]


def get_news_post_by_slug(
    connection: sqlite3.Connection,
    slug: str,
    *,
    include_drafts: bool = False,
) -> dict[str, Any] | None:
    where_clause, where_args = news_visibility_clause(include_drafts)
    row = connection.execute(
        f"""
        SELECT
            news_posts.*,
            users.username AS author_username,
            users.global_name AS author_global_name
        FROM news_posts
        LEFT JOIN users ON users.id = news_posts.created_by_user_id
        {where_clause} {"AND" if where_clause else "WHERE"} news_posts.slug = ?
        LIMIT 1
        """,
        (*where_args, slug),
    ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "slug": row["slug"],
        "title": row["title"],
        "excerpt": row["excerpt"],
        "body": row["body"],
        "status": row["status"],
        "publishedAt": row["published_at"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "authorDisplayName": row["author_global_name"] or row["author_username"] or "Ghosted",
    }


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


def build_login_href(auth_config: AuthConfig, next_path: str) -> str | None:
    normalized_next = normalize_local_path(next_path)
    if auth_config.oauth_ready:
        return f"/auth/discord/login?next={quote(normalized_next, safe='/?=&')}"
    if env_flag("ENABLE_DEV_AUTH", False):
        return f"/auth/dev-login?next={quote(normalized_next, safe='/?=&')}"
    return None


def normalize_local_path(path: str | None) -> str:
    normalized = str(path or "/").strip() or "/"
    if not normalized.startswith("/"):
        return "/"
    return normalized


SITE_BRAND = {
    "label": "Ghosted",
    "href": "/",
}

SITE_LINKS = {
    "twitch": {
        "key": "twitch",
        "label": "Twitch",
        "href": "https://www.twitch.tv/vghosted",
        "rel": "noopener noreferrer",
        "presentation": "link",
    },
    "discord": {
        "key": "discord",
        "label": "Discord",
        "href": "https://discord.gg/ghosted",
        "target": "_blank",
        "rel": "noopener noreferrer",
        "presentation": "button",
    },
}

SITE_UTILITY_GROUPS = {
    "public": ["twitch", "discord"],
    "app": ["twitch"],
}

SITE_NAV_ITEMS = [
    {"key": "home", "label": "Home", "href": "/"},
    {"key": "app", "label": "App Hub", "href": "/app/"},
    {"key": "community", "label": "Community", "href": "/app/community/"},
    {"key": "rewards", "label": "Rewards", "href": "/app/rewards/"},
    {"key": "giveaways", "label": "Giveaways", "href": "/app/giveaways/"},
    {"key": "casino", "label": "Casino", "href": "/app/casino/"},
    {"key": "companion", "label": "Companion", "href": "/app/companion/"},
    {"key": "profile", "label": "Profile", "href": "/app/profile/"},
]


def active_route_key(path: str | None) -> str:
    normalized = normalize_local_path(path)
    if normalized == "/":
        return "home"
    if normalized in {"/app", "/app/"}:
        return "app"
    if normalized.startswith("/app/community") or normalized.startswith("/app/clan") or normalized.startswith("/app/competitions"):
        return "community"
    if normalized.startswith("/app/rewards"):
        return "rewards"
    if normalized.startswith("/app/giveaways"):
        return "giveaways"
    if normalized.startswith("/app/casino"):
        return "casino"
    if normalized.startswith("/app/companion"):
        return "companion"
    if normalized.startswith("/app/profile"):
        return "profile"
    if normalized.startswith("/admin"):
        return "admin"
    return ""


def site_navigation_items(*, is_admin: bool = False) -> list[dict[str, Any]]:
    items = [dict(item) for item in SITE_NAV_ITEMS]
    if is_admin:
        items.append({"key": "admin", "label": "Admin", "href": "/admin/"})
    return items


def site_links_payload() -> dict[str, dict[str, Any]]:
    return {
        key: dict(link)
        for key, link in SITE_LINKS.items()
    }


def site_utility_groups_payload() -> dict[str, list[str]]:
    return {
        key: list(values)
        for key, values in SITE_UTILITY_GROUPS.items()
    }


def site_shell_payload(
    connection: sqlite3.Connection,
    user_row: sqlite3.Row | None,
    *,
    base_url: str | None = None,
    next_path: str = "/",
) -> dict[str, Any]:
    auth_config = build_auth_config(base_url)
    login_href = build_login_href(auth_config, next_path)
    current_route_key = active_route_key(next_path)
    if not user_row:
        return {
            "brand": dict(SITE_BRAND),
            "links": site_links_payload(),
            "utilityGroups": site_utility_groups_payload(),
            "activeRouteKey": current_route_key,
            "authenticated": False,
            "auth": {
                "configured": auth_config.oauth_ready,
                "devAuthEnabled": env_flag("ENABLE_DEV_AUTH", False),
                "canSignIn": bool(login_href),
                "loginHref": login_href,
            },
            "user": None,
            "profile": None,
            "wom": {
                "configured": wom_group_id() is not None,
                "linked": False,
                "username": None,
                "displayName": None,
                "inGroup": False,
                "membership": None,
                "lastSyncedAt": None,
            },
            "navigation": site_navigation_items(),
        }

    role_directory = build_role_directory(auth_config)
    user = profile_payload(connection, user_row, auth_config=auth_config, role_directory=role_directory)
    wom_link = user.get("womLink") or {}
    return {
        "brand": dict(SITE_BRAND),
        "links": site_links_payload(),
        "utilityGroups": site_utility_groups_payload(),
        "activeRouteKey": current_route_key,
        "authenticated": True,
        "auth": {
            "configured": auth_config.oauth_ready,
            "devAuthEnabled": env_flag("ENABLE_DEV_AUTH", False),
            "canSignIn": bool(login_href),
            "loginHref": login_href,
        },
        "user": user,
        "profile": {
            "rolesCount": len(user.get("roleDetails") or []),
            "perks": user.get("perks") or [],
            "recentSpins": len(user.get("recentSpins") or []),
            "giveawayEntries": int(user.get("giveawayEntries") or 0),
        },
        "wom": {
            "configured": wom_group_id() is not None,
            "linked": bool(wom_link.get("linked")),
            "username": wom_link.get("username"),
            "displayName": wom_link.get("displayName"),
            "inGroup": bool(wom_link.get("inGroup")),
            "membership": wom_link.get("membership"),
            "lastSyncedAt": wom_link.get("lastSyncedAt"),
        },
        "navigation": site_navigation_items(is_admin=bool(user.get("isAdmin"))),
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
    account = get_user_game_account(connection, int(user_row["id"]), "osrs") or account
    membership = wom_membership_payload(connection, account, force_refresh=force_refresh)
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
        "membership": membership,
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


def create_news_post(
    connection: sqlite3.Connection,
    actor_row: sqlite3.Row,
    payload: dict[str, Any],
) -> dict[str, Any]:
    title = str(payload.get("title", "")).strip()
    excerpt = str(payload.get("excerpt", "")).strip()
    body = str(payload.get("body", "")).strip()
    status = str(payload.get("status", "draft")).strip().lower()
    published_at_raw = str(payload.get("publishedAt", "")).strip()

    if not title or not excerpt or not body:
        raise AppError("Title, excerpt, and body are required.")
    if status not in {"draft", "published"}:
        raise AppError("Status must be 'draft' or 'published'.")

    now = utc_now()
    published_at: str | None = None
    if status == "published":
        if published_at_raw:
            parsed = parse_iso(published_at_raw)
            if not parsed:
                raise AppError("Published date is invalid.")
            published_at = utc_iso(parsed.astimezone(timezone.utc))
        else:
            published_at = utc_iso(now)

    slug_base = slugify(title)
    slug = slug_base
    suffix = 1
    while connection.execute("SELECT 1 FROM news_posts WHERE slug = ? LIMIT 1", (slug,)).fetchone():
        suffix += 1
        slug = f"{slug_base}-{suffix}"

    created_at = utc_iso(now)
    connection.execute(
        """
        INSERT INTO news_posts (
            slug, title, excerpt, body, status, published_at, created_by_user_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (slug, title, excerpt, body, status, published_at, int(actor_row["id"]), created_at, created_at),
    )
    post_id = int(connection.execute("SELECT last_insert_rowid()").fetchone()[0])
    audit(connection, actor_row["id"], "create_news_post", "news_post", str(post_id), {"title": title, "status": status})
    connection.commit()
    return {"id": post_id, "slug": slug, "title": title, "status": status, "publishedAt": published_at}


def delete_news_post(connection: sqlite3.Connection, actor_row: sqlite3.Row, post_id: int) -> dict[str, Any]:
    row = connection.execute("SELECT id, slug, title FROM news_posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        raise AppError("News post not found.", 404)
    connection.execute("DELETE FROM news_posts WHERE id = ?", (post_id,))
    audit(connection, actor_row["id"], "delete_news_post", "news_post", str(post_id), {"slug": row["slug"], "title": row["title"]})
    connection.commit()
    return {"id": int(row["id"]), "slug": row["slug"], "title": row["title"]}


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
    news_count = int(connection.execute("SELECT COUNT(*) AS count FROM news_posts").fetchone()["count"])
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
        "newsCount": news_count,
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

    def do_HEAD(self) -> None:
        connection = connect_database()
        try:
            prune_expired_sessions(connection)
            self.route_request("HEAD", connection)
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

    def read_multipart_body(self) -> tuple[dict[str, str], dict[str, UploadedFile]]:
        content_type = str(self.headers.get("Content-Type") or "")
        if "multipart/form-data" not in content_type.lower():
            raise AppError("Expected multipart/form-data for companion asset uploads.", 400)

        _, content_type_params = parse_header_parameters(content_type)
        boundary = content_type_params.get("boundary")
        if not boundary:
            raise AppError("Upload request is missing a multipart boundary.", 400)

        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            raise AppError("Upload request body was empty.", 400)

        raw = self.rfile.read(length)
        delimiter = f"--{boundary}".encode("utf-8")
        fields: dict[str, str] = {}
        files: dict[str, UploadedFile] = {}
        for chunk in raw.split(delimiter):
            part = chunk.strip()
            if not part or part == b"--":
                continue
            if part.startswith(b"--"):
                break
            if part.startswith(b"\r\n"):
                part = part[2:]
            if part.endswith(b"--"):
                part = part[:-2]
            part = part.rstrip(b"\r\n")
            if b"\r\n\r\n" not in part:
                continue

            raw_headers, data = part.split(b"\r\n\r\n", 1)
            headers: dict[str, str] = {}
            for line in raw_headers.decode("utf-8", errors="ignore").split("\r\n"):
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                headers[key.strip().lower()] = value.strip()

            disposition, disposition_params = parse_header_parameters(headers.get("content-disposition", ""))
            if disposition != "form-data":
                continue

            name = disposition_params.get("name")
            if not name:
                continue

            filename = disposition_params.get("filename")
            content = data.rstrip(b"\r\n")
            if filename:
                files[name] = UploadedFile(
                    filename=Path(filename).name,
                    content_type=headers.get("content-type", "application/octet-stream"),
                    data=content,
                )
            else:
                fields[name] = content.decode("utf-8", errors="ignore")

    def route_request(self, method: str, connection: sqlite3.Connection) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if method == "GET" and path == "/api/config":
            self.handle_api_config()
            return
        if method == "GET" and path == "/api/site-shell":
            self.handle_api_site_shell(connection, parsed)
            return
        if method == "GET" and path == "/api/me":
            self.handle_api_me(connection, parsed)
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
        if method == "GET" and path == "/api/companion":
            self.handle_api_companion(connection)
            return
        if method == "GET" and path == "/api/companion/admin/library":
            self.handle_api_companion_admin_library(connection)
            return
        if method == "POST" and path == "/api/companion/admin/base":
            self.handle_api_companion_admin_base(connection)
            return
        if method == "POST" and path == "/api/companion/admin/items":
            self.handle_api_companion_admin_items(connection)
            return
        if method == "POST" and path == "/api/companion/admin/items/replace-assets":
            self.handle_api_companion_admin_replace_assets(connection)
            return
        if method == "POST" and path == "/api/companion/purchase":
            self.handle_api_companion_purchase(connection)
            return
        if method == "POST" and path == "/api/companion/equip":
            self.handle_api_companion_equip(connection)
            return
        if method == "GET" and path.startswith("/api/companion/assets/"):
            self.handle_api_companion_asset(parsed)
            return
        if method == "GET" and path == "/api/companion/render":
            self.handle_api_companion_render(connection, parsed)
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
        if method == "GET" and path == "/api/news":
            self.handle_api_news(connection, parsed)
            return
        if method == "GET" and path.startswith("/api/news/"):
            self.handle_api_news_detail(connection, path)
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
        if method == "GET" and path == "/api/admin/news":
            self.require_admin(connection)
            params = parse_qs(parsed.query)
            limit = int(params.get("limit", ["30"])[0] or 30)
            self.respond_json({"posts": list_news_posts(connection, include_drafts=True, limit=limit)})
            return
        if method == "POST" and path == "/api/admin/news":
            actor = self.require_admin(connection)
            result = create_news_post(connection, actor, self.read_json_body())
            self.respond_json({"ok": True, "result": result}, status=201)
            return
        if method == "DELETE" and path.startswith("/api/admin/news/"):
            actor = self.require_admin(connection)
            post_id = int(path.split("/")[-1])
            result = delete_news_post(connection, actor, post_id)
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

        if method in {"GET", "HEAD"}:
            self.serve_static(path, send_body=method == "GET")
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

    def handle_api_site_shell(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        next_path = params.get("next", ["/"])[0] or "/"
        row = self.current_user(connection)
        self.respond_json(site_shell_payload(connection, row, base_url=self.base_url(), next_path=next_path))

    def handle_api_me(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        next_path = params.get("next", ["/"])[0] or "/"
        row = self.current_user(connection)
        self.respond_json(site_shell_payload(connection, row, base_url=self.base_url(), next_path=next_path))

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

    def handle_api_companion(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        self.respond_json(companion_payload(connection, row))

    def handle_api_companion_admin_library(self, connection: sqlite3.Connection) -> None:
        self.require_admin(connection)
        self.respond_json(companion_admin_payload(connection))

    def handle_api_companion_admin_base(self, connection: sqlite3.Connection) -> None:
        actor = self.require_admin(connection)
        _, files = self.read_multipart_body()
        asset = files.get("asset")
        if not asset:
            raise AppError("Upload a base asset file first.", 400)

        self.respond_json(
            {
                "ok": True,
                "message": "Companion base updated.",
                "library": upload_companion_base_asset(connection, actor, asset),
                "companion": companion_payload(connection, actor),
            },
            status=201,
        )

    def handle_api_companion_admin_items(self, connection: sqlite3.Connection) -> None:
        actor = self.require_admin(connection)
        fields, files = self.read_multipart_body()
        name = str(fields.get("name") or "").strip()
        slug = str(fields.get("slug") or "").strip() or None
        slot = str(fields.get("slot") or "").strip()
        rarity = str(fields.get("rarity") or "").strip()
        description = str(fields.get("description") or "").strip()
        cost_raw = str(fields.get("cost") or "0").strip()
        try:
            cost = int(cost_raw or "0")
        except ValueError as exc:
            raise AppError("Companion cosmetic cost must be a whole number.", 400) from exc

        front_asset = files.get("frontAsset")
        if not front_asset:
            raise AppError("A front asset image is required for new cosmetics.", 400)
        back_asset = files.get("backAsset")
        self.respond_json(
            {
                "ok": True,
                "message": "Custom companion cosmetic created.",
                "library": create_companion_item(
                    connection,
                    actor,
                    name=name,
                    slug=slug,
                    slot=slot,
                    rarity=rarity,
                    cost=cost,
                    description=description,
                    front_asset=front_asset,
                    back_asset=back_asset,
                ),
                "companion": companion_payload(connection, actor),
            },
            status=201,
        )

    def handle_api_companion_admin_replace_assets(self, connection: sqlite3.Connection) -> None:
        actor = self.require_admin(connection)
        fields, files = self.read_multipart_body()
        slug = str(fields.get("slug") or "").strip()
        if not slug:
            raise AppError("Choose a cosmetic slug to replace assets for.", 400)
        front_asset = files.get("frontAsset")
        back_asset = files.get("backAsset")
        self.respond_json(
            {
                "ok": True,
                "message": "Companion assets replaced.",
                "library": replace_companion_item_assets(
                    connection,
                    actor,
                    slug,
                    front_asset=front_asset,
                    back_asset=back_asset,
                ),
                "companion": companion_payload(connection, actor),
            }
        )

    def handle_api_companion_purchase(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        payload = self.read_json_body()
        slug = str(payload.get("slug") or "").strip()
        if not slug:
            raise AppError("A companion item slug is required.", 400)
        self.respond_json(
            {
                "ok": True,
                "message": "Companion cosmetic unlocked.",
                "companion": purchase_companion_item(connection, row, slug),
            },
            status=201,
        )

    def handle_api_companion_equip(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        payload = self.read_json_body()
        slot = str(payload.get("slot") or "").strip()
        slug = str(payload.get("slug") or "").strip() or None
        self.respond_json(
            {
                "ok": True,
                "message": "Companion updated.",
                "companion": equip_companion_item(connection, row, slot, slug),
            }
        )

    def handle_api_companion_render(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        preview_slug = str(params.get("preview", [""])[0] or "").strip()
        card = str(params.get("card", [""])[0] or "").strip().lower() in {"1", "true", "yes"}
        user_ref = str(params.get("user", [""])[0] or "").strip()

        loadout = {slot: None for slot in COMPANION_SLOT_ORDER}
        display = "Ghosted Companion"
        subtitle = "Preview"

        if user_ref:
            row = get_user(connection, int(user_ref)) if user_ref.isdigit() else get_user_by_discord_id(connection, user_ref)
            if not row:
                raise AppError("Companion owner not found.", 404)
            loadout = companion_loadout_map(connection, int(row["id"]))
            display = display_name(row)
            subtitle = f"@{row['username']}"
        else:
            row = self.current_user(connection)
            if row:
                loadout = companion_loadout_map(connection, int(row["id"]))
                display = display_name(row)
                subtitle = f"@{row['username']}"

        if preview_slug:
            item = companion_catalog_any_row(connection, preview_slug)
            if not item:
                raise AppError("Preview item not found.", 404)
            loadout[str(item["slot_key"])] = preview_slug
            if not user_ref:
                display = str(item["name"])
                subtitle = COMPANION_SLOT_LABELS.get(str(item["slot_key"]), str(item["slot_key"]).title())

        self.respond_svg(render_companion_svg(connection, loadout, display_name=display, subtitle=subtitle, card=card))

    def handle_api_companion_asset(self, parsed: Any) -> None:
        raw_path = parsed.path.removeprefix("/api/companion/assets/")
        relative_path = unquote(raw_path)
        target = companion_asset_path(relative_path)
        if not target.exists() or not target.is_file():
            raise AppError("Companion asset not found.", 404)

        mime = (
            COMPANION_ALLOWED_ASSET_EXTENSIONS.get(target.suffix.lower())
            or mimetypes.guess_type(target.name)[0]
            or "application/octet-stream"
        )
        body = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

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
        self.respond_json({"ok": True, "message": "WOM account linked.", "result": result}, status=201)

    def handle_api_wom_unlink(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        result = unlink_wom_account(connection, row)
        self.respond_json({"ok": True, "message": "WOM account unlinked.", "result": result})

    def handle_api_spin(self, connection: sqlite3.Connection) -> None:
        row = self.require_user(connection)
        payload = self.read_json_body()
        result = spin_game(connection, row, str(payload.get("gameSlug", "")).strip())
        self.respond_json({"ok": True, "result": result})

    def handle_api_giveaways(self, connection: sqlite3.Connection) -> None:
        row = self.current_user(connection)
        role_directory = build_role_directory(build_auth_config(self.base_url()))
        self.respond_json({"giveaways": list_giveaways(connection, row, role_directory=role_directory)})

    def handle_api_news(self, connection: sqlite3.Connection, parsed: Any) -> None:
        params = parse_qs(parsed.query)
        limit = int(params.get("limit", ["12"])[0] or 12)
        self.respond_json({"posts": list_news_posts(connection, limit=limit)})

    def handle_api_news_detail(self, connection: sqlite3.Connection, path: str) -> None:
        slug = path.split("/api/news/", 1)[-1].strip()
        if not slug:
            raise AppError("News slug is required.", 400)
        post = get_news_post_by_slug(connection, slug)
        if not post:
            raise AppError("News post not found.", 404)
        self.respond_json({"post": post})

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

    def serve_static(self, path: str, *, send_body: bool = True) -> None:
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
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.end_headers()
        if send_body:
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

    def respond_svg(self, markup: str, status: int = 200) -> None:
        body = markup.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "image/svg+xml; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
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
