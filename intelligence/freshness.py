"""Exclude stale observations and failed collector data from research views."""
from datetime import datetime, timezone

MAX_AGE_DAYS = {'weather': 1, 'maritime': 3, 'energy': 7, 'economics': 7}


def eligible(event, snapshot, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        return False, 'clock missing timezone'
    source = event.get('source', {}).get('name')
    key = {'ECB statistics': 'ecb', 'U.S. Treasury': 'ust',
           'U.S. Energy Information Administration': 'eia',
           'IMF PortWatch': 'portwatch'}.get(source)
    if key and not snapshot.get('status', {}).get(key, {}).get('ok', False):
        return False, 'source collector failed'
    hub = event.get('metadata', {}).get('hub')
    if hub and snapshot.get('hubs', {}).get(hub, {}).get('src') != key:
        return False, 'source provenance mismatch'
    try:
        timestamp = datetime.fromisoformat(event['observed_at'].replace('Z', '+00:00'))
        age_days = (now - timestamp).total_seconds() / 86400
    except (KeyError, ValueError, TypeError):
        return False, 'invalid observation timestamp'
    if age_days < -1 or age_days > MAX_AGE_DAYS.get(event.get('domain'), 1):
        return False, 'outside freshness window'
    return True, None
