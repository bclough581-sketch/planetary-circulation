"""Bounded context collection only. No prices, studies, signals or public output."""
import copy
import datetime as dt
import json
import os
from pathlib import Path
import secrets
import urllib.error
import urllib.parse
import urllib.request

SCHEMA = 'amalgam.ucdp-summary.v1'
VERSION = '26.1'
ENDPOINT = 'https://ucdpapi.pcr.uu.se/api/gedevents/' + VERSION
START = dt.date(2025, 12, 1)
END = dt.date(2025, 12, 31)
MAX_REQUESTS = 20
PAGE_SIZE = 1000
CITATION = ('Sundberg, Ralph, and Erik Melander (2013). Introducing the UCDP '
            'Georeferenced Event Dataset. Journal of Peace Research 50(4): 523-532. '
            'UCDP GED version 26.1; Högbladh, Stina (2026), UCDP GED Codebook version 26.1.')
REGIONS = {'Africa', 'Americas', 'Asia', 'Europe', 'Middle East'}


class CollectionError(Exception):
    """Only fixed safe codes may be logged; never HTTP bodies or exceptions."""


def utcnow():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def initial():
    return dict(schema=SCHEMA, display_allowed=False, dataset_version=VERSION,
                dataset_coverage_end=END.isoformat(), source_url=ENDPOINT,
                citation=CITATION, window={'start': START.isoformat(), 'end': None,
                'basis': 'date_end inclusive'}, regions=[], retrieved_utc=None,
                last_attempt_utc=None, stale=True, status='never_collected', request_count=0)


def integer(value):
    return type(value) is int and value >= 0


def validate(s):
    if not isinstance(s, dict) or s.get('schema') != SCHEMA or s.get('display_allowed') is not False:
        raise CollectionError('invalid_schema_or_display')
    if (s.get('dataset_version') != VERSION or s.get('source_url') != ENDPOINT or
            s.get('citation') != CITATION or s.get('dataset_coverage_end') != END.isoformat()):
        raise CollectionError('invalid_provenance')
    if type(s.get('stale')) is not bool or not integer(s.get('request_count')) or s['request_count'] > MAX_REQUESTS:
        raise CollectionError('invalid_status')
    for key in ('retrieved_utc', 'last_attempt_utc'):
        if s.get(key) is not None:
            try:
                stamp = dt.datetime.fromisoformat(s[key].replace('Z', '+00:00'))
                if stamp.utcoffset() != dt.timedelta(0):
                    raise ValueError()
            except (ValueError, TypeError, AttributeError):
                raise CollectionError('invalid_timestamp') from None
    w = s.get('window', {})
    if w.get('start') != START.isoformat() or w.get('basis') != 'date_end inclusive':
        raise CollectionError('invalid_window')
    if w.get('end') is not None:
        try:
            if not START <= dt.date.fromisoformat(w['end']) <= END:
                raise ValueError()
        except (ValueError, TypeError):
            raise CollectionError('invalid_window') from None
    elif s.get('regions') or s.get('retrieved_utc') is not None:
        raise CollectionError('invalid_empty_state')
    if not isinstance(s.get('regions'), list):
        raise CollectionError('invalid_regions')
    seen = set()
    for r in s['regions']:
        if not isinstance(r, dict) or r.get('region') not in REGIONS or r['region'] in seen:
            raise CollectionError('invalid_region')
        seen.add(r['region'])
        f = r.get('fatalities', {})
        if not integer(r.get('event_count')) or not all(integer(f.get(k)) for k in ('low', 'best', 'high')):
            raise CollectionError('invalid_counts')
        if not f['low'] <= f['best'] <= f['high']:
            raise CollectionError('invalid_fatality_bounds')
    if w.get('end') is not None and s.get('retrieved_utc') is None:
        raise CollectionError('missing_retrieval')
    return s


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None  # Never forward the secret header to another URL.


def fetch(url, token):
    request = urllib.request.Request(url, headers={'x-ucdp-access-token': token})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=45) as response:
            raw = response.read(10_000_001)
            if len(raw) > 10_000_000:
                raise CollectionError('response_too_large')
            return json.loads(raw)
    except urllib.error.HTTPError as error:
        raise CollectionError('auth_error' if error.code in (401, 403) else
                              'rate_error' if error.code == 429 else 'http_error') from None
    except CollectionError:
        raise
    except Exception:
        raise CollectionError('transport_or_json_error') from None


def collect(previous, token, get=fetch, now=None):
    """Commit a complete seven-day slice, or retain all last-good data unchanged."""
    previous = validate(previous)
    now = now or utcnow()
    result = copy.deepcopy(previous)
    result.update(last_attempt_utc=now, request_count=0, display_allowed=False)
    if not token:
        result.update(stale=True, status='missing_key')
        return result
    start = START if previous['window']['end'] is None else dt.date.fromisoformat(previous['window']['end']) + dt.timedelta(days=1)
    if start > END:
        result.update(stale=True, status='pinned_coverage_complete')
        return result  # No clock advancement or claim of contemporary coverage.
    end = min(start + dt.timedelta(days=6), END)
    rows, seen, total, pages = [], set(), None, None
    try:
        page = 1
        while True:
            if result['request_count'] >= MAX_REQUESTS:
                raise CollectionError('request_budget_exhausted')
            url = ENDPOINT + '?' + urllib.parse.urlencode(dict(StartDate=start.isoformat(), EndDate=end.isoformat(), pagesize=PAGE_SIZE, page=page))
            result['request_count'] += 1  # Count attempts, including all errors.
            payload = get(url, token)
            if not isinstance(payload, dict) or not isinstance(payload.get('Result'), list):
                raise CollectionError('invalid_page')
            count, n_pages = payload.get('TotalCount'), payload.get('TotalPages')
            if not integer(count) or not integer(n_pages) or n_pages > MAX_REQUESTS or (count > 0 and n_pages < 1):
                raise CollectionError('invalid_pagination')
            if total is None:
                total, pages = count, n_pages
                if pages != max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE) and not (total == 0 and pages == 0):
                    raise CollectionError('invalid_pagination')
            if (count, n_pages) != (total, pages) or len(payload['Result']) > PAGE_SIZE:
                raise CollectionError('pagination_changed')
            for r in payload['Result']:
                if not isinstance(r, dict) or type(r.get('id')) is not int or r['id'] in seen:
                    raise CollectionError('duplicate_or_invalid_event')
                seen.add(r['id'])
                try:
                    date_end = dt.date.fromisoformat(r['date_end'][:10])
                except (KeyError, TypeError, ValueError):
                    raise CollectionError('invalid_event_date') from None
                if not start <= date_end <= end:
                    raise CollectionError('filter_not_respected')
                if r.get('region') not in REGIONS or not all(integer(r.get(k)) for k in ('low', 'best', 'high')) or not r['low'] <= r['best'] <= r['high']:
                    raise CollectionError('invalid_event_counts')
                rows.append(r)
            if page >= pages:
                break
            page += 1
        if len(rows) != total:
            raise CollectionError('incomplete_pagination')
        aggregates = {r['region']: copy.deepcopy(r) for r in previous['regions']}
        for r in rows:
            a = aggregates.setdefault(r['region'], dict(region=r['region'], event_count=0, fatalities=dict(low=0, best=0, high=0)))
            a['event_count'] += 1
            for k in ('low', 'best', 'high'):
                a['fatalities'][k] += r[k]
        result['regions'] = sorted(aggregates.values(), key=lambda r: r['region'])
        result['window']['end'] = end.isoformat()
        result.update(retrieved_utc=now, stale=True, status='collected_historical_context')
        # Historical coverage stays stale for contemporary context even on a successful pull.
    except CollectionError:
        raise
    return validate(result)


def safe_collect(previous, token, get=fetch, now=None):
    count = 0
    def counted(url, key):
        nonlocal count
        count += 1
        return get(url, key)
    try:
        return collect(previous, token, counted, now)
    except Exception as error:
        result = copy.deepcopy(validate(previous))
        codes = {'auth_error', 'rate_error', 'http_error', 'transport_or_json_error',
                 'request_budget_exhausted', 'invalid_page', 'invalid_pagination',
                 'pagination_changed', 'duplicate_or_invalid_event', 'invalid_event_date',
                 'filter_not_respected', 'invalid_event_counts', 'incomplete_pagination', 'response_too_large'}
        code = str(error) if isinstance(error, CollectionError) and str(error) in codes else 'collection_failed'
        result.update(stale=True, status=code, last_attempt_utc=now or utcnow(), request_count=count)
        return validate(result)


def seal(data, token):
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    salt, nonce = secrets.token_bytes(16), secrets.token_bytes(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=600000).derive(token.encode())
    return salt + nonce + AESGCM(key).encrypt(nonce, data, SCHEMA.encode())


def unseal(data, token):
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=data[:16], iterations=600000).derive(token.encode())
    return AESGCM(key).decrypt(data[16:28], data[28:], SCHEMA.encode())


def main():
    token = os.environ.get('UCDP_API_KEY', '')
    sealed = Path('dark-state/ucdp-summary.sealed')
    if not token:
        print('UCDP status=missing_key requests=0')
        return 1
    try:
        previous = validate(json.loads(unseal(sealed.read_bytes(), token))) if sealed.exists() else initial()
    except Exception:
        print('UCDP status=state_restore_failed requests=0')
        return 1
    result = safe_collect(previous, token)
    raw = json.dumps(result, sort_keys=True).encode()
    if token.encode() in raw:
        print('UCDP status=secret_output_blocked')
        return 1
    # Plaintext exists only on ephemeral runner; neither committed nor uploaded.
    output = Path('product-data/ucdp-conflict-summary.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(raw)
    sealed.parent.mkdir(parents=True, exist_ok=True)
    sealed.write_bytes(seal(raw, token))
    print('UCDP status=' + result['status'] + ' requests=' + str(result['request_count']) + ' display_allowed=false')
    return 0 if result['status'] in {'collected_historical_context', 'pinned_coverage_complete'} else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        print('UCDP status=internal_error')
        raise SystemExit(1) from None
