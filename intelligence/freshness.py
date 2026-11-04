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
    if source not in {'NOAA National Weather Service', 'ECB statistics', 'U.S. Treasury',
                      'U.S. Energy Information Administration', 'IMF PortWatch'}:
        return False, 'unrecognized source'
    expected_domains = {'NOAA National Weather Service': 'weather',
                        'ECB statistics': 'economics', 'U.S. Treasury': 'economics',
                        'U.S. Energy Information Administration': 'energy',
                        'IMF PortWatch': 'maritime'}
    if event.get('domain') != expected_domains[source]:
        return False, 'source domain mismatch'
    if key and not snapshot.get('status', {}).get(key, {}).get('ok', False):
        return False, 'source collector failed'
    hub = event.get('metadata', {}).get('hub')
    if hub and snapshot.get('hubs', {}).get(hub, {}).get('src') != key:
        return False, 'source provenance mismatch'
    try:
        timestamp = datetime.fromisoformat(event['observed_at'].replace('Z', '+00:00'))
        if timestamp.tzinfo is None:
            raise ValueError('timezone missing')
        age_days = (now - timestamp).total_seconds() / 86400
    except (KeyError, ValueError, TypeError):
        return False, 'invalid observation timestamp'
    if event.get('domain') == 'weather' and source == 'NOAA National Weather Service':
        expires = event.get('metadata', {}).get('expires')
        if not expires:
            return False, 'missing alert expiry'
        try:
            expiry = datetime.fromisoformat(expires.replace('Z', '+00:00'))
            if expiry.tzinfo is None:
                raise ValueError('timezone missing')
        except (ValueError, TypeError, AttributeError):
            return False, 'invalid alert expiry'
        if expiry <= now:
            return False, 'alert expired'
    if age_days < -1 or age_days > MAX_AGE_DAYS.get(event.get('domain'), 1):
        return False, 'outside freshness window'
    return True, None
