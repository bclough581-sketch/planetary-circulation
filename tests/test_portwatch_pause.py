"""Offline regressions: paused data never survives refresh, including failures."""
import contextlib, copy, io, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import fetch_data, check_data

class PortWatchPause(unittest.TestCase):
    def test_direct_collectors_fail_without_network(self):
        with patch.object(fetch_data, "get", side_effect=AssertionError("network forbidden")) as get:
            for fn, args in [(fetch_data.fetch_portwatch, ()), (fetch_data._pw, ({},))]:
                with self.assertRaisesRegex(RuntimeError, "paused"):
                    fn(*args)
            get.assert_not_called()

    def test_refresh_discards_previous_shipping_even_when_all_sources_fail(self):
        original = json.loads(Path(fetch_data.OUT).read_text())
        original["chokepoints"] = [{"latest": 987654321, "name": "PRIVATE_SENTINEL"}]
        original["status"]["portwatch"] = {"ok": True, "last_ok_utc": "2020-01-01T00:00:00Z"}
        for fail in (False, True):
            with self.subTest(all_failed=fail), tempfile.TemporaryDirectory() as td:
                out = Path(td)/"data.json"
                out.write_text(json.dumps(original))
                with contextlib.ExitStack() as stack:
                    stack.enter_context(patch.object(fetch_data, "OUT", str(out)))
                    network = stack.enter_context(patch.object(fetch_data, "get", side_effect=AssertionError("network forbidden")))
                    pw = stack.enter_context(patch.object(fetch_data, "fetch_portwatch", side_effect=AssertionError("paused collector called")))
                    for name in ("fetch_ecb", "fetch_ust", "fetch_eia", "fetch_tic"):
                        stack.enter_context(patch.object(fetch_data, name, side_effect=RuntimeError("offline") if fail else None, return_value=copy.deepcopy(original["hubs"]["NYC"]) if name == "fetch_ust" else ({} if name != "fetch_tic" else "unchanged")))
                    stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                    stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                    if fail:
                        with self.assertRaises(SystemExit): fetch_data.main()
                    else: fetch_data.main()
                    network.assert_not_called(); pw.assert_not_called()
                actual = json.loads(out.read_text())
                self.assertEqual(actual["chokepoints"], [])
                self.assertEqual(actual["hubs"], original["hubs"])
                self.assertTrue(actual["status"]["portwatch"]["paused"])
                self.assertNotIn("987654321", out.read_text())
                self.assertNotIn("last_ok_utc", actual["status"]["portwatch"])

    def test_release_payload_has_no_shipping_and_gate_rejects_reintroduction(self):
        data = json.loads(Path(fetch_data.OUT).read_text())
        self.assertEqual(data["chokepoints"], [])
        data["chokepoints"] = [{"latest": 1, "avg7": 1, "base": 1, "ratio": 1, "asof": "2026-01-01"}]
        self.assertTrue(any("redistribution paused" in e for e in check_data.check(data, {})))
