"""Identify which ArcGIS query parameters fail, without storing source records."""
import json
import urllib.parse
import urllib.request

ROOT = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"
BASE = {"where": "1=1", "outFields": "portid,portname,date",
        "returnGeometry": "false", "resultRecordCount": "1", "f": "json"}


def probe(opener=urllib.request.urlopen):
    cases = [
        ("control", {}),
        ("page_size_20", {"resultRecordCount": "20"}),
        ("offset_zero", {"resultOffset": "0"}),
        ("offset_one", {"resultOffset": "1"}),
        ("sort_date", {"orderByFields": "date DESC"}),
        ("return_count", {"returnCountOnly": "true"}),
        ("filter_year", {"where": "year = 2026"}),
        ("filter_port", {"where": "portname IS NOT NULL"}),
    ]
    results = []
    for label, changes in cases:
        args = dict(BASE)
        args.update(changes)
        if "returnCountOnly" in changes:
            args.pop("outFields", None)
            args.pop("resultRecordCount", None)
        req = urllib.request.Request(ROOT + "?" + urllib.parse.urlencode(args),
                                     headers={"User-Agent": "Amalgam source diagnostic"})
        try:
            with opener(req, timeout=20) as response:
                data = json.load(response)
            results.append({"case": label, "ok": "error" not in data,
                            "returned": len(data.get("features", [])),
                            "error_code": data.get("error", {}).get("code"),
                            "error_message": data.get("error", {}).get("message")})
        except Exception as exc:
            results.append({"case": label, "ok": False, "exception": str(exc)[:120]})
    return results


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
