"""Inspect IMF PortWatch ArcGIS metadata without redistributing source data."""
import json
import urllib.request

SERVICE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0"


def inspect_service(opener=urllib.request.urlopen):
    req = urllib.request.Request(SERVICE + "?f=pjson",
                                 headers={"User-Agent": "Amalgam source-health diagnostic"})
    with opener(req, timeout=25) as response:
        payload = json.load(response)
    if "error" in payload:
        return {"status": "api_error", "error": payload["error"]}
    fields = [f.get("name") for f in payload.get("fields", [])]
    return {
        "status": "metadata_read",
        "service_name": payload.get("name"),
        "query_supported": "Query" in payload.get("capabilities", ""),
        "date_field_present": "date" in fields,
        "portid_field_present": "portid" in fields,
        "portname_field_present": "portname" in fields,
        "field_names": fields,
        "note": "Metadata availability does not grant commercial redistribution rights.",
    }


if __name__ == "__main__":
    print(json.dumps(inspect_service(), indent=2))
