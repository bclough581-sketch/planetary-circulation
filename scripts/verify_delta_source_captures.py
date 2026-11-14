"""Offline integrity check; never fetch a URL or substitute a fresh response."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--capture-directory", type=Path, required=True)
    args = parser.parse_args()
    records = json.loads((ROOT / "product-data/delta-source-capture-receipts.json").read_text())
    data = json.loads((ROOT / "product-data/delta-company-evidence.json").read_text())
    for record in records["captures"]:
        path = args.capture_directory / record["file"]
        if path.parent.resolve() != args.capture_directory.resolve():
            raise ValueError("Capture path escapes directory")
        raw = path.read_bytes()
        source = data["sources"][record["period"]]
        if not (hashlib.sha256(raw).hexdigest() == record["sha256"] == source["raw_sha256"]
                and len(raw) == record["bytes"] and source["retrieved_utc"] == record["retrieved_utc"]
                and source["url"] == record["url"]):
            raise ValueError("Capture/receipt/product mismatch: " + record["period"])
        print(record["period"] + ": stored bytes, receipt hash, URL and product timestamp match")
    print("Integrity only: local receipt times are not independently authenticated historical availability.")


if __name__ == "__main__":
    main()
