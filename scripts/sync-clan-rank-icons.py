#!/usr/bin/env python3
import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlencode

API_BASE = "https://oldschool.runescape.wiki/api.php"
CATEGORY_TITLE = "Category:Clan_rank_icons"
USER_AGENT = "GhostedDev/1.0"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "public" / "symbols" / "clan-ranks"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def api_json(params: dict[str, str]) -> dict:
    request = urllib.request.Request(f"{API_BASE}?{urlencode(params)}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_category_titles() -> list[str]:
    titles: list[str] = []
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": CATEGORY_TITLE,
        "cmlimit": "500",
        "format": "json",
    }
    continuation: dict[str, str] = {}
    while True:
        payload = api_json({**params, **continuation})
        titles.extend(item["title"] for item in payload.get("query", {}).get("categorymembers", []))
        continuation = payload.get("continue", {})
        if not continuation:
            break
    return titles


def chunked(values: list[str], size: int) -> list[list[str]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def fetch_image_urls(file_titles: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for batch in chunked(file_titles, 50):
        payload = api_json(
            {
                "action": "query",
                "titles": "|".join(batch),
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json",
            }
        )
        for page in payload.get("query", {}).get("pages", {}).values():
            title = page.get("title")
            infos = page.get("imageinfo") or []
            if title and infos and infos[0].get("url"):
                mapping[str(title)] = str(infos[0]["url"])
    return mapping


def download(url: str, target: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        target.write_bytes(response.read())


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    file_titles = fetch_category_titles()
    image_urls = fetch_image_urls(file_titles)
    manifest: dict[str, dict[str, str]] = {}

    for title, url in sorted(image_urls.items()):
        label = title.removeprefix("File:Clan icon - ").removesuffix(".png")
        slug = slugify(label)
        filename = f"{slug}.png"
        target = OUTPUT_DIR / filename
        download(url, target)
        manifest[slug] = {
            "label": label,
            "file": f"/symbols/clan-ranks/{filename}",
            "sourceUrl": url,
            "wikiTitle": title,
        }

    (OUTPUT_DIR / "index.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Downloaded {len(manifest)} clan rank icons to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
