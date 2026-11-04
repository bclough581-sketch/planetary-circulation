"""Audit historical decision schedules without treating them as publication evidence."""
import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path

from .point_in_time import parse_instant


def audit_decision_schedule(panel, schedule):
    if panel.get("schema") != "amalgam.cross-domain-observation-panel.v1":
        raise ValueError("unsupported historical panel")
    if panel.get("predictive_advantage") != "not_established":
        raise ValueError("unsupported predictive claim")
    if not isinstance(schedule, dict):
        raise ValueError("decision schedule must be a date-to-UTC-timestamp mapping")
    dates = [row["date"] for row in panel["observations"]]
    if len(dates) != len(set(dates)):
        raise ValueError("duplicate panel dates")
    missing = sorted(set(dates) - set(schedule))
    extra = sorted(set(schedule) - set(dates))
    invalid = []
    valid = []
    for day in sorted(set(dates) & set(schedule)):
        try:
            observation_day = date.fromisoformat(day)
            decision = parse_instant(schedule[day])
            if decision.date() < observation_day:
                raise ValueError("decision predates observation date")
            valid.append(day)
        except (ValueError, TypeError):
            invalid.append(day)
    return {
        "schema": "amalgam.historical-decision-schedule-audit.v1",
        "panel_observation_count": len(dates),
        "scheduled_count": len(valid),
        "missing_dates": missing,
        "extra_dates": extra,
        "invalid_dates": invalid,
        "schedule_complete": not (missing or extra or invalid),
        "asof_eligible_count": 0,
        "predictive_advantage": "not_established",
        "warning": "A decision schedule is not independent proof of publication or trade-time availability. No rows become eligible."
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--panel", required=True)
    parser.add_argument("--schedule", required=True)
    parser.add_argument("--output", default="historical-decision-schedule-audit.json")
    args = parser.parse_args()
    panel = json.loads(Path(args.panel).read_text(encoding="utf-8"))
    schedule = json.loads(Path(args.schedule).read_text(encoding="utf-8"))
    result = audit_decision_schedule(panel, schedule)
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
