"""Compare PortWatch parameter changes against a confirmed working baseline.

No shipping records are saved or printed.
"""
import json
import urllib.parse
import urllib.request

ROOT = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"
BASE = {"where": "portname IS NOT NULL", "outFields": "portid,portname,date",
        "returnGeometry": "false", "resultRecordCount": "1", "f": "json"}


def probe(opener=urllib.request.urlopen):
    cases = [
        ("control", {}),
        ("page_size_20", {"resultRecordCount": "20"}),
        ("offset_zero", {"resultOffset": "0"}),
        ("offset_one", {"resultOffset": "1"}),
        ("sort_date", {"orderByFields": "date DESC"}),
        ("filter_year", {"where": "year = 2026"}),
        ("filter_date", {"where": "date IS NOT NULL"}),
        ("port_and_year", {"where": "portname IS NOT NULL AND year = 2026"}),
    ]
    results = []
    for label, change in cases:
        args = {**BASE, **change}
        req = urllib.request.Request(ROOT + "?" + urllib.parse.urlencode(args),
                                     headers={"User-Agent": "Amalgam source health probe"})
        try:
            with opener(req, timeout=15) as response:
                data = json.load(response)
            err = data.get("error", {})
            results.append({"case": label, "ok": not bool(err),
                            "rows": len(data.get("features", [])),
                            "error_code": err.get("code"), "error": err.get("message")})
        except Exception as exc:
            results.append({"case": label, "ok": False, "exception": str(exc)[:120]})
    return results


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
