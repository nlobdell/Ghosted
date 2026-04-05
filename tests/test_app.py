import io
import json
import os
import shutil
import unittest
from pathlib import Path
from unittest.mock import patch

import server


PLAYER = {
    "id": 555,
    "username": "GhostedRSN",
    "displayName": "Ghosted RSN",
    "type": "regular",
    "build": "main",
    "status": "active",
    "exp": 123456789,
    "ehp": 432.1,
    "ehb": 12.3,
    "updatedAt": "2026-04-02T01:00:00Z",
    "lastChangedAt": "2026-04-02T00:30:00Z",
    "lastImportedAt": "2026-04-02T01:05:00Z",
}

PLAYER_GROUPS = [
    {
        "groupId": 123,
        "group": {"id": 123, "name": "Ghosted"},
        "role": "event_captain",
        "rankOrder": 4,
    }
]

PLAYER_GROUPS_NO_RANK = [
    {
        "groupId": 123,
        "group": {"id": 123, "name": "Ghosted"},
        "role": "member",
    }
]

OUTSIDER_GROUPS = [
    {
        "groupId": 999,
        "group": {"id": 999, "name": "Elsewhere"},
        "role": "member",
    }
]

GROUP = {
    "id": 123,
    "name": "Ghosted",
    "clanChat": "Ghosted",
    "description": "Ghosted clan",
    "homeworld": 421,
    "memberCount": 77,
    "score": 9001,
    "verified": True,
    "updatedAt": "2026-04-02T02:00:00Z",
}

GROUP_STATS = {
    "maxedCombatCount": 4,
    "maxedTotalCount": 2,
    "maxed200msCount": 1,
    "averageStats": {
        "data": {
            "skills": {
                "overall": {
                    "level": 1920,
                    "experience": 87654321,
                }
            },
            "computed": {
                "ehp": {"value": 321.5},
                "ehb": {"value": 45.7},
            },
        }
    },
}

PLAYER_REF = {
    "id": PLAYER["id"],
    "username": PLAYER["username"],
    "displayName": PLAYER["displayName"],
}

GROUP_ACHIEVEMENTS = [
    {
        "name": "99 Magic",
        "metric": "magic",
        "measure": "experience",
        "threshold": 13034431,
        "createdAt": "2026-04-02T00:00:00Z",
        "player": PLAYER_REF,
    }
]

GROUP_ACTIVITY = [
    {
        "type": "joined",
        "createdAt": "2026-04-02T00:00:00Z",
        "player": PLAYER_REF,
    }
]

GROUP_HISCORES = [
    {
        "player": PLAYER_REF,
        "data": {
            "rank": 17,
            "experience": 123456789,
            "level": 2227,
        },
    }
]

GROUP_GAINS = [
    {
        "player": PLAYER_REF,
        "gained": 987654,
    }
]

COMPETITION = {
    "id": 42,
    "title": "Ghosted SOTW",
    "metric": "agility",
    "type": "classic",
    "startsAt": "2026-04-01T00:00:00Z",
    "endsAt": "2026-04-08T00:00:00Z",
    "groupId": 123,
    "score": 900,
}

COMPETITION_DETAIL = {
    **COMPETITION,
    "participants": [
        {
            "rank": 1,
            "player": PLAYER_REF,
            "progress": {
                "start": 1000,
                "end": 5000,
                "gained": 4000,
            },
            "updatedAt": "2026-04-02T01:00:00Z",
        }
    ],
}

TOP_HISTORY = [
    {
        "player": PLAYER_REF,
        "history": [{"value": 1000, "date": "2026-04-01T00:00:00Z"}],
    }
]


class FakeHandler(server.GhostedHandler):
    def __init__(self, path: str, *, body: dict | None = None, user=None):
        self.path = path
        raw = json.dumps(body).encode("utf-8") if body is not None else b""
        self.headers = {"Content-Length": str(len(raw))} if body is not None else {}
        self.rfile = io.BytesIO(raw)
        self.payload = None
        self.status = None
        self.user = user

    def respond_json(self, payload, status=200):
        self.payload = payload
        self.status = status

    def respond_svg(self, markup, status=200):
        self.payload = markup
        self.status = status

    def base_url(self):
        return "http://localhost:8000"

    def current_user(self, connection):
        return self.user

    def require_user(self, connection):
        if not self.user:
            raise server.AppError("Please sign in with Discord first.", 401)
        return self.user

    def require_admin(self, connection):
        row = self.require_user(connection)
        if not row["is_admin"]:
            raise server.AppError("You do not have access to admin tools.", 403)
        return row

    def read_json_body(self):
        return server.GhostedHandler.read_json_body(self)


class GhostedAppTests(unittest.TestCase):
    def setUp(self):
        self.asset_dir = Path.cwd() / "data" / "test-companion-assets"
        if self.asset_dir.exists():
            shutil.rmtree(self.asset_dir)
        self.env_patch = patch.dict(
            os.environ,
            {
                "WOM_GROUP_ID": "123",
                "WOM_CACHE_TTL_SECONDS": "900",
                "COMPANION_ASSET_DIR": str(self.asset_dir),
            },
            clear=False,
        )
        self.env_patch.start()
        self.db_path = Path.cwd() / "data" / "test_app.db"
        if self.db_path.exists():
            self.db_path.unlink()
        self.connection = server.connect_database(self.db_path)
        server.init_database(self.connection)
        self.user = server.create_or_update_user(
            self.connection,
            {"id": "test-user", "username": "tester", "global_name": "Tester", "avatar": None},
            [],
        )
        server.ensure_user_rewards(self.connection, self.user, server.build_auth_config("http://localhost:8000"))
        self.connection.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (self.user["id"],))
        self.connection.commit()
        self.user = server.get_user_by_discord_id(self.connection, "test-user")

    def tearDown(self):
        self.connection.close()
        if self.db_path.exists():
            self.db_path.unlink()
        if self.asset_dir.exists():
            shutil.rmtree(self.asset_dir)
        self.env_patch.stop()

    def wom_cached_side_effect(self, connection, path, *, query=None, force_refresh=False, allow_stale=True):
        if path == "/players/GhostedRSN/groups":
            return PLAYER_GROUPS
        if path == "/groups/123":
            return GROUP
        if path == "/groups/123/statistics":
            return GROUP_STATS
        if path == "/groups/123/achievements":
            return GROUP_ACHIEVEMENTS
        if path == "/groups/123/activity":
            return GROUP_ACTIVITY
        if path == "/groups/123/hiscores":
            return GROUP_HISCORES
        if path == "/groups/123/gained":
            return GROUP_GAINS
        if path == "/groups/123/competitions":
            return [COMPETITION]
        if path == "/players/id/555":
            return PLAYER
        if path == "/players/GhostedRSN/gained":
            return {"skills": {"overall": {"gained": 987654}}}
        if path == "/players/GhostedRSN/achievements":
            return GROUP_ACHIEVEMENTS
        if path == "/players/GhostedRSN/competitions/standings":
            return [COMPETITION]
        if path == "/competitions/42":
            return COMPETITION_DETAIL
        if path == "/competitions/42/top-history":
            return TOP_HISTORY
        raise AssertionError(f"Unhandled WOM path in test: {path} query={query}")

    def make_handler(self, path: str, *, body: dict | None = None, user=None):
        return FakeHandler(path, body=body, user=user)

    def test_welcome_bonus_is_seeded(self):
        self.assertEqual(server.get_balance(self.connection, self.user["id"]), server.STARTING_BALANCE)

    def test_spin_deducts_and_records(self):
        result = server.spin_game(self.connection, self.user, "jigsaw-jackpot", rng=server.random.Random(5))
        self.assertIn("symbols", result)
        self.assertGreaterEqual(server.get_balance(self.connection, self.user["id"]), 0)
        spins = server.recent_spins(self.connection, self.user["id"])
        self.assertEqual(len(spins), 1)

    def test_giveaway_entry_spends_points(self):
        giveaway = self.connection.execute("SELECT id FROM giveaways LIMIT 1").fetchone()
        result = server.enter_giveaway(self.connection, self.user, int(giveaway["id"]))
        self.assertEqual(result["giveawayId"], giveaway["id"])
        self.assertLess(server.get_balance(self.connection, self.user["id"]), server.STARTING_BALANCE)

    def test_companion_purchase_unlocks_item_and_spends_points(self):
        payload = server.purchase_companion_item(self.connection, self.user, "witch-hat")

        self.assertEqual(payload["ownedCount"], 1)
        self.assertEqual(payload["balance"], server.STARTING_BALANCE - 120)
        inventory = self.connection.execute(
            "SELECT item_slug FROM user_companion_inventory WHERE user_id = ?",
            (self.user["id"],),
        ).fetchall()
        self.assertEqual([row["item_slug"] for row in inventory], ["witch-hat"])

    def test_companion_seed_writes_default_assets_to_disk(self):
        base_row = self.connection.execute(
            "SELECT base_asset_path FROM companion_settings WHERE singleton_key = 'default'",
        ).fetchone()
        item_row = self.connection.execute(
            "SELECT front_asset_path FROM companion_catalog WHERE slug = 'witch-hat'",
        ).fetchone()

        self.assertIsNotNone(base_row)
        self.assertTrue(str(base_row["base_asset_path"]).startswith("repo/"))
        self.assertTrue(str(item_row["front_asset_path"]).startswith("repo/"))
        self.assertTrue(server.companion_asset_path(base_row["base_asset_path"]).exists())
        self.assertTrue(server.companion_asset_path(item_row["front_asset_path"]).exists())

    def test_create_companion_item_stores_uploaded_files(self):
        library = server.create_companion_item(
            self.connection,
            self.user,
            name="Moon Hood",
            slug="moon-hood",
            slot="hat",
            rarity="rare",
            cost=90,
            description="Custom upload",
            front_asset=server.UploadedFile(
                filename="moon-hood.svg",
                content_type="image/svg+xml",
                data=b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"></svg>',
            ),
        )

        row = self.connection.execute(
            "SELECT front_asset_path FROM companion_catalog WHERE slug = 'moon-hood'",
        ).fetchone()
        self.assertIsNotNone(row)
        self.assertIn("uploads/items", row["front_asset_path"])
        self.assertTrue((self.asset_dir / row["front_asset_path"]).exists())
        self.assertTrue(any(item["slug"] == "moon-hood" for item in library["items"]))

    def test_companion_equip_requires_owned_item(self):
        with self.assertRaises(server.AppError) as exc:
            server.equip_companion_item(self.connection, self.user, "hat", "witch-hat")

        self.assertEqual(exc.exception.status, 400)

    def test_companion_render_preview_endpoint(self):
        handler = self.make_handler("/api/companion/render?preview=witch-hat", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertIn("<svg", handler.payload)
        self.assertIn("data:image/svg+xml;base64", handler.payload)

    @patch("server.wom_cached_json")
    @patch("server.wom_request_json")
    def test_link_wom_account_success(self, wom_request_json, wom_cached_json):
        wom_request_json.return_value = PLAYER
        wom_cached_json.return_value = PLAYER_GROUPS

        result = server.link_wom_account(self.connection, self.user, "GhostedRSN")

        self.assertTrue(result["linked"])
        self.assertEqual(result["playerId"], PLAYER["id"])
        account = server.get_user_game_account(self.connection, self.user["id"])
        self.assertIsNotNone(account)
        self.assertEqual(account["username"], PLAYER["username"])

    @patch("server.wom_cached_json")
    @patch("server.wom_request_json")
    def test_duplicate_relink_updates_existing_account(self, wom_request_json, wom_cached_json):
        wom_request_json.return_value = PLAYER
        wom_cached_json.return_value = PLAYER_GROUPS
        server.link_wom_account(self.connection, self.user, "GhostedRSN")

        updated_player = {**PLAYER, "displayName": "Ghosted RSN Updated"}
        wom_request_json.return_value = updated_player
        server.link_wom_account(self.connection, self.user, "GhostedRSN")

        account = server.get_user_game_account(self.connection, self.user["id"])
        count = self.connection.execute("SELECT COUNT(*) AS count FROM user_game_accounts").fetchone()["count"]
        self.assertEqual(count, 1)
        self.assertEqual(account["display_name"], "Ghosted RSN Updated")

    def test_invalid_wom_username_is_rejected(self):
        with self.assertRaises(server.AppError) as exc:
            server.link_wom_account(self.connection, self.user, "")
        self.assertEqual(exc.exception.status, 400)

    @patch("server.wom_cached_json")
    @patch("server.wom_request_json")
    def test_player_not_in_group_is_rejected(self, wom_request_json, wom_cached_json):
        wom_request_json.return_value = PLAYER
        wom_cached_json.return_value = []

        with self.assertRaises(server.AppError) as exc:
            server.link_wom_account(self.connection, self.user, "GhostedRSN")

        self.assertEqual(exc.exception.status, 400)

    def test_wom_cache_freshness_prefers_cached_payload(self):
        expected = {"hello": "world"}
        server.set_wom_cache_entry(self.connection, "groups/123", expected)

        with patch("server.wom_request_json", side_effect=AssertionError("network should not be called")):
            payload = server.wom_cached_json(self.connection, "/groups/123")

        self.assertEqual(payload, expected)

    def test_wom_cache_stale_fallback_returns_stale_payload(self):
        expected = {"stale": True}
        server.set_wom_cache_entry(self.connection, "groups/123", expected)
        self.connection.execute(
            "UPDATE wom_cache SET expires_at = ? WHERE cache_key = ?",
            ("2000-01-01T00:00:00+00:00", "groups/123"),
        )
        self.connection.commit()

        with patch("server.wom_request_json", side_effect=server.AppError("upstream failed", 502)):
            payload = server.wom_cached_json(self.connection, "/groups/123")

        self.assertEqual(payload, expected)

    def test_wom_upstream_failure_without_cache_raises(self):
        with patch("server.wom_request_json", side_effect=server.AppError("upstream failed", 502)):
            with self.assertRaises(server.AppError):
                server.wom_cached_json(self.connection, "/groups/123")

    @patch("server.wom_cached_json")
    @patch("server.wom_request_json")
    def test_profile_wom_link_endpoint(self, wom_request_json, wom_cached_json):
        wom_request_json.return_value = PLAYER
        wom_cached_json.return_value = PLAYER_GROUPS
        handler = self.make_handler("/api/profile/wom-link", body={"username": "GhostedRSN"}, user=self.user)

        server.GhostedHandler.route_request(handler, "POST", self.connection)

        self.assertEqual(handler.status, 201)
        self.assertTrue(handler.payload["result"]["linked"])
        self.assertEqual(handler.payload["result"]["membership"]["rankLabel"], "Event Captain")

    @patch("server.wom_cached_json")
    def test_wom_clan_endpoint(self, wom_cached_json):
        wom_cached_json.side_effect = self.wom_cached_side_effect
        handler = self.make_handler("/api/wom/clan", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.payload["group"]["name"], "Ghosted")
        self.assertEqual(handler.payload["featuredHiscores"]["entries"][0]["player"]["displayName"], PLAYER["displayName"])

    @patch("server.wom_cached_json")
    def test_wom_me_endpoint(self, wom_cached_json):
        server.save_user_game_account(self.connection, self.user["id"], "osrs", PLAYER)
        wom_cached_json.side_effect = self.wom_cached_side_effect
        handler = self.make_handler("/api/wom/me", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.payload["player"]["id"], PLAYER["id"])
        self.assertEqual(handler.payload["competitions"][0]["id"], COMPETITION["id"])
        self.assertEqual(handler.payload["membership"]["rankLabel"], "Event Captain")

    @patch("server.wom_cached_json")
    def test_wom_me_normalizes_membership_when_optional_fields_are_missing(self, wom_cached_json):
        server.save_user_game_account(self.connection, self.user["id"], "osrs", PLAYER)

        def side_effect(connection, path, *, query=None, force_refresh=False, allow_stale=True):
            if path == "/players/GhostedRSN/groups":
                return PLAYER_GROUPS_NO_RANK
            return self.wom_cached_side_effect(
                connection,
                path,
                query=query,
                force_refresh=force_refresh,
                allow_stale=allow_stale,
            )

        wom_cached_json.side_effect = side_effect
        payload = server.wom_me_payload(self.connection, self.user)

        self.assertEqual(payload["membership"]["rankLabel"], "Member")

    def test_site_shell_signed_out_response(self):
        handler = self.make_handler("/api/site-shell?next=/hall/")

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertFalse(handler.payload["authenticated"])
        self.assertIsNone(handler.payload["user"])
        self.assertEqual(handler.payload["brand"]["label"], "Ghosted")
        self.assertEqual(handler.payload["links"]["discord"]["href"], "https://discord.gg/ghosted")
        self.assertEqual(handler.payload["utilityGroups"]["public"], ["twitch", "discord"])
        self.assertEqual(handler.payload["activeRouteKey"], "app")
        self.assertEqual(handler.payload["navigation"][0]["key"], "home")

    def test_site_shell_signed_in_without_wom_link(self):
        handler = self.make_handler("/api/site-shell?next=/hall/profile/", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertTrue(handler.payload["authenticated"])
        self.assertFalse(handler.payload["wom"]["linked"])
        self.assertEqual(handler.payload["activeRouteKey"], "profile")
        self.assertEqual(handler.payload["profile"]["rolesCount"], 0)
        self.assertIn("admin", [item["key"] for item in handler.payload["navigation"]])

    @patch("server.wom_cached_json")
    def test_site_shell_signed_in_with_wom_rank(self, wom_cached_json):
        server.save_user_game_account(self.connection, self.user["id"], "osrs", PLAYER)
        wom_cached_json.return_value = PLAYER_GROUPS
        handler = self.make_handler("/api/site-shell?next=/hall/profile/", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertTrue(handler.payload["wom"]["linked"])
        self.assertTrue(handler.payload["wom"]["inGroup"])
        self.assertEqual(handler.payload["wom"]["membership"]["rankLabel"], "Event Captain")

    @patch("server.wom_cached_json")
    def test_site_shell_signed_in_with_linked_player_outside_group(self, wom_cached_json):
        server.save_user_game_account(self.connection, self.user["id"], "osrs", PLAYER)
        wom_cached_json.return_value = OUTSIDER_GROUPS
        handler = self.make_handler("/api/site-shell?next=/hall/profile/", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertTrue(handler.payload["wom"]["linked"])
        self.assertFalse(handler.payload["wom"]["inGroup"])
        self.assertIsNone(handler.payload["wom"]["membership"])

    def test_site_shell_hides_admin_navigation_for_non_admin_user(self):
        member = server.create_or_update_user(
            self.connection,
            {"id": "member-user", "username": "member", "global_name": "Member", "avatar": None},
            [],
        )
        server.ensure_user_rewards(self.connection, member, server.build_auth_config("http://localhost:8000"))
        member = server.get_user_by_discord_id(self.connection, "member-user")

        payload = server.site_shell_payload(self.connection, member, base_url="http://localhost:8000", next_path="/hall/clan/")

        self.assertEqual(payload["activeRouteKey"], "community")
        self.assertNotIn("admin", [item["key"] for item in payload["navigation"]])

    def test_site_shell_marks_admin_route_for_admin_user(self):
        payload = server.site_shell_payload(self.connection, self.user, base_url="http://localhost:8000", next_path="/admin/")

        self.assertEqual(payload["activeRouteKey"], "admin")
        self.assertIn("admin", [item["key"] for item in payload["navigation"]])

    def test_active_route_key_groups_related_routes(self):
        self.assertEqual(server.active_route_key("/hall/clan/"), "community")
        self.assertEqual(server.active_route_key("/hall/competitions/"), "community")
        self.assertEqual(server.active_route_key("/hall/casino/"), "casino")
        self.assertEqual(server.active_route_key("/hall/ghostling/"), "companion")

    @patch("server.wom_cached_json")
    def test_wom_hiscores_endpoint(self, wom_cached_json):
        wom_cached_json.side_effect = self.wom_cached_side_effect
        handler = self.make_handler("/api/wom/hiscores?metric=overall&limit=5", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.payload["metric"], "overall")
        self.assertEqual(handler.payload["entries"][0]["rank"], 17)

    @patch("server.wom_cached_json")
    def test_wom_gains_endpoint(self, wom_cached_json):
        wom_cached_json.side_effect = self.wom_cached_side_effect
        handler = self.make_handler("/api/wom/gains?metric=overall&period=week&limit=5", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.payload["period"], "week")
        self.assertEqual(handler.payload["entries"][0]["gained"], GROUP_GAINS[0]["gained"])

    @patch("server.wom_cached_json")
    def test_wom_competition_detail_endpoint(self, wom_cached_json):
        wom_cached_json.side_effect = self.wom_cached_side_effect
        handler = self.make_handler("/api/wom/competitions/42", user=self.user)

        server.GhostedHandler.route_request(handler, "GET", self.connection)

        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.payload["competition"]["id"], 42)
        self.assertEqual(handler.payload["topHistory"][0]["player"]["displayName"], PLAYER["displayName"])

    def test_competition_status_classification(self):
        self.assertEqual(
            server.competition_status(
                "2026-04-05T00:00:00Z",
                "2026-04-06T00:00:00Z",
                now=server.parse_iso("2026-04-04T00:00:00Z"),
            ),
            "upcoming",
        )
        self.assertEqual(
            server.competition_status(
                "2026-04-01T00:00:00Z",
                "2026-04-06T00:00:00Z",
                now=server.parse_iso("2026-04-04T00:00:00Z"),
            ),
            "ongoing",
        )
        self.assertEqual(
            server.competition_status(
                "2026-04-01T00:00:00Z",
                "2026-04-03T00:00:00Z",
                now=server.parse_iso("2026-04-04T00:00:00Z"),
            ),
            "finished",
        )


if __name__ == "__main__":
    unittest.main()
