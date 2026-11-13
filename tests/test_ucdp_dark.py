import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from scripts import collect_ucdp_dark as c


def page(rows=None):
    rows = rows if rows is not None else [dict(id=1, region='Africa', date_end='2025-12-02', low=1, best=2, high=3)]
    return dict(TotalCount=len(rows), TotalPages=1, Result=rows)


class DarkCollectorTests(unittest.TestCase):
    def test_success_schema_and_incremental(self):
        calls = []
        def get(url, key):
            calls.append(url)
            return page()
        s = c.safe_collect(c.initial(), 'synthetic-secret-only', get)
        c.validate(s)
        self.assertEqual(s['regions'][0]['fatalities'], dict(low=1, best=2, high=3))
        self.assertEqual(s['window']['end'], '2025-12-07')
        self.assertFalse(s['display_allowed'])
        self.assertIn('StartDate=2025-12-01', calls[0])
        next_calls = []
        c.safe_collect(s, 'synthetic-secret-only', lambda u, k: next_calls.append(u) or page([]))
        self.assertIn('StartDate=2025-12-08', next_calls[0])

    def test_failures_retain_good_data_and_clock(self):
        good = c.safe_collect(c.initial(), 'synthetic-secret-only', lambda *a: page())
        for code in ('auth_error', 'rate_error', 'transport_or_json_error'):
            calls = []
            def fail(*args):
                calls.append(1)
                raise c.CollectionError(code)
            failed = c.safe_collect(good, 'synthetic-secret-only', fail)
            self.assertEqual(len(calls), 1)
            for key in ('regions', 'window', 'retrieved_utc'):
                self.assertEqual(failed[key], good[key])
            self.assertTrue(failed['stale'])
            self.assertEqual(failed['request_count'], 1)

    def test_pagination_budget_and_duplicates_fail_closed(self):
        good = c.initial()
        bad = [dict(TotalCount=20001, TotalPages=21, Result=[]),
               dict(TotalCount=2, TotalPages=1, Result=page()['Result'] * 2),
               dict(TotalCount=2, TotalPages=1, Result=page()['Result'])]
        for payload in bad:
            s = c.safe_collect(good, 'synthetic-secret-only', lambda *a: payload)
            self.assertIsNone(s['retrieved_utc'])
            self.assertEqual(s['regions'], [])
            self.assertEqual(s['request_count'], 1)

    def test_partial_second_page_never_commits(self):
        rows = [dict(id=i, region='Africa', date_end='2025-12-02', low=1, best=1, high=1) for i in range(1000)]
        def get(url, token):
            if 'page=2' in url:
                raise c.CollectionError('rate_error')
            return dict(TotalCount=1001, TotalPages=2, Result=rows)
        s = c.safe_collect(c.initial(), 'synthetic-secret-only', get)
        self.assertEqual(s['request_count'], 2)
        self.assertEqual(s['regions'], [])
        self.assertIsNone(s['window']['end'])

    def test_missing_key_no_requests(self):
        s = c.safe_collect(c.initial(), '', lambda *a: self.fail('network called'))
        self.assertEqual(s['request_count'], 0)
        self.assertEqual(s['status'], 'missing_key')

    def test_schema_fail_closed(self):
        for mutation in (lambda s: s.pop('display_allowed'), lambda s: s.update(display_allowed=True),
                         lambda s: s.update(dataset_version='guessed'), lambda s: s.update(request_count=5000)):
            s = c.initial()
            mutation(s)
            with self.assertRaises(c.CollectionError):
                c.validate(s)

    def test_filters_and_fatality_bounds(self):
        for change in (dict(date_end='2026-01-01'), dict(low=-1), dict(best=4), dict(region='unexpected')):
            p = page()
            p['Result'][0].update(change)
            s = c.safe_collect(c.initial(), 'synthetic-secret-only', lambda *a: p)
            self.assertIsNone(s['retrieved_utc'])

    def test_sealed_state_no_plaintext_and_wrong_key_rejected(self):
        # Runtime-generated key: no real token or token-shaped fixture in Git.
        key = c.secrets.token_urlsafe(32)
        raw = json.dumps(c.initial()).encode()
        encrypted = c.seal(raw, key)
        self.assertNotIn(key.encode(), encrypted)
        self.assertNotIn(b'display_allowed', encrypted)
        self.assertEqual(c.unseal(encrypted, key), raw)
        with self.assertRaises(Exception):
            c.unseal(encrypted, c.secrets.token_urlsafe(32))

    def test_secret_not_in_summary_or_repository(self):
        key = c.secrets.token_urlsafe(32)
        result = c.safe_collect(c.initial(), key, lambda *a: page())
        self.assertNotIn(key, json.dumps(result))
        root = Path(__file__).resolve().parents[1]
        for folder in ('scripts', 'tests', 'product-data', '.github/workflows'):
            for p in (root / folder).rglob('*'):
                if p.is_file() and p.suffix in {'.py', '.json', '.yml', '.js', '.cjs'}:
                    self.assertNotIn(key.encode(), p.read_bytes())

    def test_no_page_bundle_or_service_worker_integration(self):
        root = Path(__file__).resolve().parents[1]
        for p in root.rglob('*'):
            if p.is_file() and p.suffix in {'.html', '.js', '.webmanifest'} and '.git' not in p.parts:
                text = p.read_text(encoding='utf-8')
                self.assertNotIn('ucdp-conflict-summary', text, str(p))
                self.assertNotIn('amalgam.ucdp-summary', text, str(p))

    def test_coverage_complete_never_advances_clock(self):
        s = c.initial()
        s['window']['end'] = c.END.isoformat()
        s['retrieved_utc'] = c.utcnow()
        result = c.safe_collect(s, 'synthetic-secret-only', lambda *a: self.fail('network called'))
        self.assertEqual(result['retrieved_utc'], s['retrieved_utc'])
        self.assertEqual(result['request_count'], 0)
        self.assertTrue(result['stale'])


if __name__ == '__main__':
    unittest.main()
