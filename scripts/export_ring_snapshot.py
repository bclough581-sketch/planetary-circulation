"""Export a local AMALGAM data.json snapshot for manual Ring Engine import.

Usage: PYTHONPATH=. python3 scripts/export_ring_snapshot.py data.json ring-snapshot.json
No network access, inferred relationships, or live-data claims.
"""
import json
import pathlib
import sys
from intelligence.ingest import snapshot_graph


def main(argv):
    if len(argv) != 3:
        raise SystemExit("Usage: export_ring_snapshot.py INPUT_JSON OUTPUT_JSON")
    source = pathlib.Path(argv[1])
    destination = pathlib.Path(argv[2])
    if source.resolve() == destination.resolve():
        raise SystemExit("Input and output must differ")
    snapshot = json.loads(source.read_text(encoding="utf-8"))
    graph = snapshot_graph(snapshot)
    graph["snapshot_generated_utc"] = snapshot.get("generated_utc")
    destination.write_text(json.dumps(graph, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Exported {len(graph['events'])} observations; excluded {len(graph['excluded_records'])}; zero inferred relationships")


if __name__ == "__main__":
    main(sys.argv)
