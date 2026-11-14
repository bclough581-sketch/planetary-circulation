#!/usr/bin/env python3
"""Phone alert via ntfy. Quiet by default: sends only when something broke or a source first goes stale.
Needs the repo secret NTFY_TOPIC (your private ntfy topic name). Without it, this prints and exits 0.
Env: NTFY_TOPIC, TESTS, FETCH, CHECK, COMMIT = outcome of those steps (success, failure, skipped)."""
import json, os, sys, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
STALE_DAYS = {"ecb": 4, "ust": 4, "eia": 12, "portwatch": 21}   # alert once, on the day a source crosses this
TIC_STALE_DAYS = 75


def problems(data, tic, env, now=None):
    now = now or datetime.now(timezone.utc)
    out = []
    for step, label in (("TESTS", "unit tests"), ("FETCH", "data fetch"), ("CHECK", "self-check"), ("COMMIT", "data commit/push")):
        if env.get(step) == "failure":
            out.append("%s failed" % label)
    for name, limit in STALE_DAYS.items():
        ts = (data.get("status", {}).get(name) or {}).get("last_ok_utc")
        if not ts:
            continue
        age = (now - datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)).total_seconds() / 86400
        if limit <= age < limit + 1:
            out.append("%s has had no good data for %d days" % (name, int(age)))
    try:
        age = (now.date() - datetime.strptime(tic["asof"], "%Y-%m-%d").date()).days
        if TIC_STALE_DAYS <= age < TIC_STALE_DAYS + 1:
            out.append("Treasury holdings have not updated in %d days" % age)
    except Exception:
        pass
    return out


def main():
    try:
        data = json.load(open(os.path.join(HERE, "data.json"), encoding="utf-8"))
        tic = json.load(open(os.path.join(HERE, "tic.json"), encoding="utf-8"))
    except Exception:
        data, tic = {}, {}
    probs = problems(data, tic, os.environ)
    if not probs:
        print("alert: nothing to report")
        return
    msg = "Amalgam data job: " + "; ".join(probs)
    print(msg)
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        print("alert: NTFY_TOPIC secret not set, so no phone alert was sent")
        return
    req = urllib.request.Request("https://ntfy.sh/" + topic, data=msg.encode("utf-8"),
                                 headers={"Title": "Amalgam needs a look", "Priority": "default"})
    try:
        urllib.request.urlopen(req, timeout=20).read()
        print("alert: sent")
    except Exception as e:
        print("alert: send failed (%s)" % e, file=sys.stderr)


if __name__ == "__main__":
    main()
