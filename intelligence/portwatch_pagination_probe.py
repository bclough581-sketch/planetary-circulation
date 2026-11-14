"""Read-only bounded ArcGIS pagination probe; never exports PortWatch records."""
import json
import urllib.parse
import urllib.request

ROOT = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"


def probe(opener=urllib.request.urlopen):
    tests = [
        ("first_page", {"where": "1=1", "outFields": "portid,portname,date",
                        "returnGeometry": "false", "resultOffset": "0",
                        "resultRecordCount": "20", "f": "json"}),
        ("second_page", {"where": "1=1", "outFields": "portid,portname,date",
                         "returnGeometry": "false", "resultOffset": "20",
                         "resultRecordCount": "20", "f": "json"}),
        ("sorted_page", {"where": "1=1", "outFields": "portid,portname,date",
                         "orderByFields": "date DESC", "returnGeometry": "false",
                         "resultRecordCount": "20", "f": "json"}),
    ]
    output = []
    for name, params in tests:
        req = urllib.request.Request(ROOT + "?" + urllib.parse.urlencode(params),
                                     headers={"User-Agent": "Amalgam read-only research diagnostic"})
        try:
            with opener(req, timeout=30) as response:
                payload = json.load(response)
            if "error" in payload:
                output.append({"name": name, "ok": False, "error": payload["error"]})
                continue
            rows = [f.get("attributes", {}) for f in payload.get("features", [])]
            dates = [str(r.get("date")) for r in rows if r.get("date") is not None]
            output.append({"name": name, "ok": True, "returned": len(rows),
                           "date_values_present": len(dates),
                           "exceeded_transfer_limit": payload.get("exceededTransferLimit")})
        except Exception as exc:
            output.append({"name": name, "ok": False, "error": str(exc)[:250]})
    return output


if __name__ == "__main__":
    print(json.dumps(probe(), indent=2))
