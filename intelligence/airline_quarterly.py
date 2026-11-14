"""Quarterly consolidated SEC facts for research; no as-of eligibility grant."""
import argparse
import hashlib
import json
import math
import os
import time
import re
import urllib.request
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path

COMPANIES = {"DAL": 27904, "UAL": 100517}
TAGS = {"revenue_usd": ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"),
        "operating_income_usd": ("OperatingIncomeLoss",)}


def sec_user_agent(contact):
    if not isinstance(contact, str) or not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", contact):
        raise ValueError("Set SEC_CONTACT_EMAIL to an authorized project contact email; no SEC request sent")
    return "AMALGAM research " + contact


def normalize(payload, symbol, start_year, end_year):
    cik = COMPANIES[symbol]
    if payload.get("cik") != cik:
        raise ValueError("company identity mismatch")
    if not 2009 <= start_year <= end_year <= date.today().year:
        raise ValueError("invalid research years")
    facts = payload.get("facts", {}).get("us-gaap", {})
    selected, excluded = {}, []
    for metric, tags in TAGS.items():
        # Keep taxonomy choice explicit rather than mixing tags across periods.
        tag = next((tag for tag in tags if facts.get(tag, {}).get("units", {}).get("USD")), None)
        if tag is None:
            raise ValueError("missing USD concept: " + metric)
        for row in facts[tag]["units"]["USD"]:
            try:
                begin, end, filed = (date.fromisoformat(row[key]) for key in ("start", "end", "filed"))
            except (KeyError, TypeError, ValueError):
                continue
            if not start_year <= end.year <= end_year:
                continue
            if row.get("form") not in ("10-Q", "10-K"):
                continue
            quarter = (end.month - 1) // 3 + 1
            # Calendar-quarter dates only; do not derive Q4 by subtracting annual totals.
            expected_start = date(end.year, 3 * quarter - 2, 1)
            expected_end = date(end.year + 1, 1, 1) if quarter == 4 else date(end.year, 3 * quarter + 1, 1)
            if begin != expected_start or (expected_end-end).days != 1:
                continue
            value, accession = row.get("val"), row.get("accn")
            if (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)
                or (metric == "revenue_usd" and value <= 0)
                or not isinstance(accession, str) or not re.fullmatch(r"\d{10}-\d{2}-\d{6}", accession)
                or not end <= filed <= date.today()):
                raise ValueError("invalid quarterly fact")
            key = (begin.isoformat(), end.isoformat(), filed.isoformat(), accession)
            cell = selected.setdefault(key, {})
            entry = {"value": value, "tag": tag}
            if metric in cell and cell[metric] != entry:
                raise ValueError("conflicting facts in same filing")
            cell[metric] = entry
    by_period = {}
    for (begin, end, filed, accession), metrics in sorted(selected.items()):
        if set(metrics) != set(TAGS):
            excluded.append({"period_end": end, "accession": accession, "reason": "metrics_not_paired_in_same_filing"})
            continue
        # Earliest filing retained in the API response, not authenticated original availability.
        candidate = {"start": begin, "end": end, "filed_date_claim": filed, "accession": accession,
                     "filing_index_url": f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession.replace('-', '')}/{accession}-index.html",
                     "metrics": metrics}
        if end not in by_period or (filed, accession) < (by_period[end]["filed_date_claim"], by_period[end]["accession"]):
            by_period[end] = candidate
    observations = [by_period[end] for end in sorted(by_period)]
    for row in observations:
        row["operating_margin_percent"] = 100 * row["metrics"]["operating_income_usd"]["value"] / row["metrics"]["revenue_usd"]["value"]
    covered = {row["end"][:4] + "Q" + str((int(row["end"][5:7])-1)//3+1) for row in observations}
    return {"symbol": symbol, "cik": cik, "observations": observations, "excluded": excluded,
            "missing_quarters": [f"{year}Q{q}" for year in range(start_year, end_year+1) for q in range(1, 5) if f"{year}Q{q}" not in covered]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year", type=int, default=2023)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--input-dir", type=Path, help="Directory containing officially downloaded CIK##########.json companyfacts files")
    parser.add_argument("--retain-inputs", type=Path, help="Save exact companyfacts response bytes for reproduction")
    args = parser.parse_args()
    user_agent = None if args.input_dir else sec_user_agent(os.environ.get("SEC_CONTACT_EMAIL"))
    companies = []
    for symbol, cik in COMPANIES.items():
        url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
        request = urllib.request.Request(url, headers={"User-Agent": user_agent or "AMALGAM local research", "Accept-Encoding": "identity"})
        if args.input_dir:
            raw = (args.input_dir / f"CIK{cik:010d}.json").read_bytes()
            payload = json.loads(raw)
        else:
            if companies:
                time.sleep(0.2)
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    raw = response.read(20_000_001)
                    if len(raw) > 20_000_000:
                        raise ValueError("SEC response exceeds retention limit")
                    payload = json.loads(raw)
            except urllib.error.HTTPError as exc:
                raise RuntimeError(f"SEC access failed (HTTP {exc.code}) for {symbol}; no quarterly dataset produced. Officially downloaded companyfacts files can be processed with --input-dir.") from None
        if args.retain_inputs:
            args.retain_inputs.mkdir(parents=True, exist_ok=True)
            (args.retain_inputs / f"CIK{cik:010d}.json").write_bytes(raw)
        company = normalize(payload, symbol, args.start_year, args.end_year)
        if not company["observations"]:
            raise ValueError("no paired quarterly facts for " + symbol)
        company["source_response_sha256"] = hashlib.sha256(raw).hexdigest()
        company["source_url"] = url
        company["input_mode"] = "local_unverified_file" if args.input_dir else "sec_api_response"
        companies.append(company)
        print(symbol, "paired quarters:", len(company["observations"]), "missing:", company["missing_quarters"])
    result = {"schema": "amalgam.airline-quarterly.v1", "retrieved_utc": datetime.now(timezone.utc).isoformat(),
              "requested_start_year": args.start_year, "requested_end_year": args.end_year,
              "companies": companies, "publication_time_verified": False, "predictive_advantage": "not_established",
              "warning": "Earliest retained filing claims are not authenticated availability. Current API facts may reflect revisions. No synthesized Q4, fuel costs, market returns or predictive evaluation."}
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
