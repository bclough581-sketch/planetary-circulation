"""Read-only PortWatch query probe: discover valid query syntax and field availability."""
import json
import urllib.parse
import urllib.request
from datetime import date, timedelta

ROOT = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"


def probe(opener=urllib.request.urlopen, today=None):
    today = today or date.today()
    # Query by stable portname first, avoiding year/month/day field assumptions.
    cases = [
        ("count_all", {"where": "1=1", "returnCountOnly": "true", "f": "json"}),
        ("sample", {"where": "1=1", "outFields": "portid,portname,date", "returnGeometry": "false",
                    "resultRecordCount": "1", "f": "json"}),
        ("date_parts", {"where": "year = %d AND month = %d AND day = %d" %
                        ((today - timedelta(days=21)).year, (today - timedelta(days=21)).month,
                         (today - timedelta(days=21)).day),
                        "outFields": "portid,portname", "returnGeometry": "false",
                        "resultRecordCount": "1", "f": "json"}),
    ]
    results = []
    for name, params in cases:
        url = ROOT + "?" + urllib.parse.urlencode(params)
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Amalgam diagnostic"})
            with opener(request, timeout=25) as response:
                payload = json.load(response)
            if payload.get("error"):
                results.append({"probe": name, "ok": False, "error": payload["error"]})
            else:
                results.append({"probe": name, "ok": True, "count": payload.get("count"),
                                "features_returned": len(payload.get("features", [])),
                                "exceeded_transfer_limit": payload.get("exceededTransferLimit")})
        except Exception as exc:
            results.append({"probe": name, "ok": False, "error": str(exc)[:300]})
    return results


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
