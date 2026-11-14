"""Refresh only EIA observations in a copy of the research snapshot.

Never changes the checked-in data.json or the production deployment.
"""
from copy import deepcopy
from .eia_research_snapshot import build


def refresh_energy(snapshot):
    fresh = build()
    updated = deepcopy(snapshot)
    updated.setdefault("hubs", {}).update(fresh["hubs"])
    updated.setdefault("status", {})["eia"] = {
        "ok": True,
        "research_only": True,
        "source": fresh["source"],
        "retrieved_utc": fresh["generated_utc"],
    }
    return updated
