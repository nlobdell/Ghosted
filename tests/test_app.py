import unittest
from pathlib import Path

import server


class GhostedAppTests(unittest.TestCase):
    def setUp(self):
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
        self.connection.commit()
        self.user = server.get_user_by_discord_id(self.connection, "test-user")

    def tearDown(self):
        self.connection.close()
        if self.db_path.exists():
            self.db_path.unlink()

    def test_welcome_bonus_is_seeded(self):
        self.assertEqual(server.get_balance(self.connection, self.user["id"]), server.STARTING_BALANCE)

    def test_spin_deducts_and_records(self):
        result = server.spin_game(self.connection, self.user, "moon-spark", rng=server.random.Random(5))
        self.assertIn("symbols", result)
        self.assertGreaterEqual(server.get_balance(self.connection, self.user["id"]), 0)
        spins = server.recent_spins(self.connection, self.user["id"])
        self.assertEqual(len(spins), 1)

    def test_giveaway_entry_spends_points(self):
        giveaway = self.connection.execute("SELECT id FROM giveaways LIMIT 1").fetchone()
        result = server.enter_giveaway(self.connection, self.user, int(giveaway["id"]))
        self.assertEqual(result["giveawayId"], giveaway["id"])
        self.assertLess(server.get_balance(self.connection, self.user["id"]), server.STARTING_BALANCE)


if __name__ == "__main__":
    unittest.main()
