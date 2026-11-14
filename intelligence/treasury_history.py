"""Research-only US Treasury daily yield curve history.

Official Treasury XML feed; no interpolation or predictive inference.
"""
from datetime import date, datetime, timezone
from pathlib import Path
import argparse
import json
import urllib.request
import xml.etree.ElementTree as ET

SOURCE = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
NS = {"a": "http://www.w3.org/2005/Atom", "m": "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata",
      "d": "http://schemas.microsoft.com/ado/2007/08/dataservices"}
TEN_YEAR = "BC_10YEAR"


def parse_xml(xml, year):
    root = ET.fromstring(xml)
    observations = {}
    for entry in root.findall(".//a:entry", NS):
        properties = entry.find(".//m:properties", NS)
        if properties is None:
            continue
        raw_date = properties.findtext("d:NEW_DATE", namespaces=NS)
        raw_rate = properties.findtext("d:" + TEN_YEAR, namespaces=NS)
        if not raw_date or not raw_rate:
            continue
        try:
            day = date.fromisoformat(raw_date[:10])
            rate = float(raw_rate)
        except ValueError:
            continue
        if day.year != year or not (0 <= rate <= 100):
            continue
        key = day.isoformat()
        if key in observations and observations[key] != rate:
            raise ValueError("conflicting Treasury yields for same date")
        observations[key] = rate
    return [{"date": day, "ten_year_yield_percent": rate}
            for day, rate in sorted(observations.items())]


def build(year, fetch=None):
    if not 1990 <= year <= datetime.now(timezone.utc).year:
        raise ValueError("year out of range")
    url = SOURCE + "?data=daily_treasury_yield_curve&field_tdr_date_value=" + str(year)
    if fetch is None:
        def fetch(address):
            request = urllib.request.Request(address, headers={"User-Agent": "Amalgam research (GitHub planetary-circulation)"})
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read()
    rows = parse_xml(fetch(url), year)
    if not rows:
        raise ValueError("Treasury returned no usable ten-year yield observations")
    return {"schema": "amalgam.treasury-history.v1",
            "retrieved_utc": datetime.now(timezone.utc).isoformat(),
            "source": "U.S. Department of the Treasury",
            "source_url": SOURCE,
            "requested_year": year,
            "frequency": "business_day", "unit": "percent_per_year",
            "observations": rows,
            "relationships": [], "predictive_advantage": "not_established",
            "warning": "Published dates are observation dates, not guaranteed real-time availability timestamps; no predictive test performed."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--output", type=Path, default=Path("treasury-history-research.json"))
    args = parser.parse_args()
    result = build(args.year)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("Treasury ten-year yield observations:", len(result["observations"]))


if __name__ == "__main__":
    main()
