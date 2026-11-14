"""Build only the product's offline company evidence; never read research inputs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "product-data/delta-company-evidence.json"
OUTPUT = ROOT / "delta-company-evidence.js"


def render():
    data = json.loads(INPUT.read_text(encoding="utf-8"))
    if data.get("schema") != "amalgam.delta-company-evidence.v1":
        raise ValueError("Unsupported product evidence")
    payload = json.dumps(data, ensure_ascii=True, indent=2).replace("<", "\\u003c").replace(">", "\\u003e")
    return "/* Product-only issuer evidence; historical research bundle stays separate. */\nwindow.AMALGAM_DELTA_COMPANY = " + payload + ";\n"


if __name__ == "__main__":
    OUTPUT.write_text(render(), encoding="utf-8", newline="\n")
    print("Built product-only Delta company evidence")
