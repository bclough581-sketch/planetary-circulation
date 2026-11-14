"""NOAA weather alert fetcher. No scheduled or production integration yet."""
import json
import urllib.request
from .ingest import noaa_alert_observations

URL = "https://api.weather.gov/alerts/active"


def fetch_active_alerts(timeout=20):
    req = urllib.request.Request(
        URL, headers={"User-Agent": "Amalgam research prototype (GitHub: bclough581-sketch/planetary-circulation)",
                      "Accept": "application/geo+json"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        payload = json.load(response)
    return noaa_alert_observations(payload)
