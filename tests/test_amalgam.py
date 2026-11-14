import copy, json, os, sys, tempfile, unittest
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import fetch_data, check_data, alert

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MONTHS13 = ["Aug", "Jul", "Jun", "May", "Apr", "Mar", "Feb", "Jan", "Dec", "Nov", "Oct", "Sep", "Aug"]
YEARS13 = ["2026"] * 8 + ["2025"] * 5


def read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f)


def mfh_text(rows=None, newest_first=True):
    base = {"Japan": 1068.3, "China, Mainland": 590.7, "United Kingdom": 1009.5, "Belgium": 400.1, "Luxembourg": 300.2,
            "Switzerland": 285.8, "Ireland": 250.0, "India": 219.7, "Brazil": 168.4, "Singapore": 277.9,
            "France": 704.0, "Saudi Arabia": 141.2}
    rows = rows or base
    months, years = (MONTHS13, YEARS13) if newest_first else (MONTHS13[::-1], YEARS13[::-1])
    out = ["        MAJOR FOREIGN HOLDERS OF TREASURY SECURITIES", "            (in billions of dollars)", "",
           "                         " + "     ".join(months),
           "Country                  " + "     ".join(years), "                         ------"]
    for name, v in rows.items():
        out.append("%-24s" % name + "   ".join("%.1f" % (v + i) for i in range(13)))
    return "\n".join(out) + "\n"


class Calcs(unittest.TestCase):
    def test_pct(self):
        self.assertAlmostEqual(fetch_data.pct(110, 100), 10.0)
        self.assertIsNone(fetch_data.pct(None, 100))
        self.assertIsNone(fetch_data.pct(5, 0))

    def test_range_stats_history(self):
        st = fetch_data.range_stats([3.0, None, 2.0, 1.0], ["2026-01-04", "2026-01-03", "2026-01-02", "2026-01-01"])
        self.assertEqual(st["hist"], [["2026-01-04", 3.0], ["2026-01-02", 2.0], ["2026-01-01", 1.0]])   # gaps dropped

    def test_range_stats(self):
        st = fetch_data.range_stats([2.0, 1.0, 4.0, 3.0])          # newest first
        self.assertEqual((st["price"], st["lo"], st["hi"]), (2.0, 1.0, 4.0))
        self.assertAlmostEqual(st["chg"], 100.0)
        self.assertIsNone(fetch_data.range_stats([1.0]))


class TicParser(unittest.TestCase):
    def test_parse(self):
        p = fetch_data.parse_mfh(mfh_text())
        self.assertEqual(p["asof"], "2026-08-31")
        self.assertEqual(p["label"], "Aug 2026")
        self.assertEqual(p["holders"]["TYO"], [1068.3, 1069.3, 1074.3])          # latest, prior, six months before
        self.assertAlmostEqual(p["holders"]["FRA"][0], 704.0 + 400.1 + 300.2 + 250.0, places=1)   # FR+BE+LU+IE

    def test_rejects_oldest_first(self):
        with self.assertRaises(ValueError):
            fetch_data.parse_mfh(mfh_text(newest_first=False))

    def test_rejects_missing_country(self):
        rows = {"Japan": 1000.0}
        with self.assertRaises(ValueError):
            fetch_data.parse_mfh(mfh_text(rows))

    def test_rejects_garbage(self):
        with self.assertRaises(ValueError):
            fetch_data.parse_mfh("<html>not the file</html>")

    def test_fetch_updates_only_when_newer(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "tic.json")
            fetch_data.TIC_PATH = path
            fetch_data.get = lambda url, timeout=60: mfh_text().encode()
            write(path, {"label": "Jul 2026", "asof": "2026-07-31", "max_age_days": 100, "holders": {}, "note": "keep me"})
            self.assertIn("updated", fetch_data.fetch_tic())
            cur = read(path)
            self.assertEqual((cur["asof"], cur["note"]), ("2026-08-31", "keep me"))     # other keys preserved
            self.assertIn("up to date", fetch_data.fetch_tic())                          # second run: nothing newer

    def test_fetch_failure_raises_and_keeps_file(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "tic.json")
            fetch_data.TIC_PATH = path
            fetch_data.get = lambda url, timeout=60: b"<html>moved</html>"
            write(path, {"asof": "2026-07-31", "holders": {"X": [1, 1, 1]}})
            with self.assertRaises(RuntimeError):
                fetch_data.fetch_tic()
            self.assertEqual(read(path)["asof"], "2026-07-31")


class SelfCheck(unittest.TestCase):
    def setUp(self):
        self.data = read(os.path.join(HERE, "data.json"))
        self.tic = read(os.path.join(HERE, "tic.json"))
        self.now = datetime.strptime(self.data["generated_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)

    def test_current_files_pass(self):
        self.assertEqual(check_data.check(self.data, self.tic, self.now), [])

    def test_catches_upside_down_currency(self):
        d = copy.deepcopy(self.data); t = d["hubs"]["TYO"]
        t.update(price=1 / t["price"], lo=1 / t["hi"], hi=1 / t["lo"])        # yen quoted the wrong way round
        self.assertTrue(any("TYO" in b for b in check_data.check(d, self.tic, self.now)))

    def test_catches_price_outside_range(self):
        d = copy.deepcopy(self.data); d["hubs"]["TYO"]["price"] = d["hubs"]["TYO"]["hi"] * 1.5
        self.assertTrue(any("TYO" in b for b in check_data.check(d, self.tic, self.now)))

    def test_catches_missing_hub_and_stale_file(self):
        d = copy.deepcopy(self.data); del d["hubs"]["HOU"]
        self.assertTrue(any("HOU" in b for b in check_data.check(d, self.tic, self.now)))
        later = datetime(2030, 1, 1, tzinfo=timezone.utc)
        self.assertTrue(any("older" in b for b in check_data.check(self.data, self.tic, later)))

    def test_catches_bad_history(self):
        d = copy.deepcopy(self.data)
        h = d["hubs"]["FRA"].get("hist")
        if h:
            h[1][0] = "2030-01-01"                      # out of order
            self.assertTrue(any("FRA history" in b for b in check_data.check(d, self.tic, self.now)))

    def test_catches_bad_chokepoint(self):
        d = copy.deepcopy(self.data)
        d["chokepoints"] = [{"ratio": 17, "latest": 1, "avg7": 1, "base": 1, "id": "synthetic", "asof": "2026-01-01"}]
        self.assertTrue(any("ratio" in b for b in check_data.check(d, self.tic, self.now)))


class Alerts(unittest.TestCase):
    def test_quiet_when_healthy(self):
        now = datetime(2026, 11, 2, tzinfo=timezone.utc)
        data = {"status": {"ecb": {"last_ok_utc": "2026-11-02T01:00:00Z"}}}
        self.assertEqual(alert.problems(data, {"asof": "2026-10-31"}, {}, now), [])

    def test_fires_once_when_source_crosses_threshold(self):
        data = {"status": {"portwatch": {"last_ok_utc": "2026-10-10T00:00:00Z"}}}
        hit = alert.problems(data, {}, {}, datetime(2026, 10, 31, 12, tzinfo=timezone.utc))     # 21.5 days
        again = alert.problems(data, {}, {}, datetime(2026, 11, 1, 12, tzinfo=timezone.utc))     # 22.5 days
        self.assertEqual(len(hit), 1)
        self.assertEqual(again, [])

    def test_reports_step_failures(self):
        out = alert.problems({}, {}, {"FETCH": "failure", "CHECK": "skipped"}, datetime(2026, 11, 2, tzinfo=timezone.utc))
        self.assertEqual(out, ["data fetch failed"])


if __name__ == "__main__":
    unittest.main()
