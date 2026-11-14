import copy
import json
import importlib.util
from pathlib import Path
import unittest
import tempfile
import io
import zipfile
from unittest.mock import patch
from scripts import collect_ucdp_dark as c
from scripts import restore_ucdp_state as restore


def page(rows=None):
    rows = rows if rows is not None else [dict(id=1, region='Africa', date_end='2025-12-02', low=1, best=2, high=3)]
    return dict(TotalCount=len(rows), TotalPages=1, Result=rows)


class DarkCollectorTests(unittest.TestCase):
    def test_current_citation_includes_release_funding_and_license(self):
        for required in ('Davies', 'Pettersson', 'Öberg', '2026', '10.1093/jopres/xjag046',
                         'DEMSCORE', '2021-00162', 'Swedish Research Council', 'CC BY 4.0'):
            self.assertIn(required, c.initial()['citation'])

    def test_legacy_citation_restores_without_reset_and_updates_on_success(self):
        previous = c.safe_collect(c.initial(), 'synthetic-secret-only', lambda *a: page())
        previous['citation'] = c.LEGACY_CITATION
        c.validate(previous)
        result = c.safe_collect(previous, 'synthetic-secret-only', lambda *a: page([]))
        self.assertEqual(result['citation'], c.CITATION)
        self.assertEqual(result['regions'], previous['regions'])
        self.assertEqual(result['window']['end'], '2025-12-14')
        def fail(*args):
            raise c.CollectionError('auth_error')
        failed = c.safe_collect(previous, 'synthetic-secret-only', fail)
        for key in ('citation', 'regions', 'window', 'retrieved_utc'):
            self.assertEqual(failed[key], previous[key])

    def test_citation_upgrade_at_coverage_end_does_not_refresh_clock(self):
        previous = c.initial()
        previous.update(citation=c.LEGACY_CITATION, retrieved_utc=c.utcnow())
        previous['window']['end'] = c.END.isoformat()
        result = c.safe_collect(previous, 'synthetic-secret-only', lambda *a: self.fail('network called'))
        self.assertEqual(result['citation'], c.CITATION)
        self.assertEqual(result['retrieved_utc'], previous['retrieved_utc'])
        self.assertEqual(result['request_count'], 0)

    @unittest.skipUnless(importlib.util.find_spec('cryptography'), 'dedicated UCDP workflow installs crypto dependency')
    def test_wrong_token_preserves_sealed_bytes_and_makes_zero_requests(self):
        original_token, wrong_token = [c.secrets.token_urlsafe(32) for _ in range(2)]
        state = c.safe_collect(c.initial(), original_token, lambda *a: page())
        sealed_bytes = c.seal(json.dumps(state).encode(), original_token)
        with tempfile.TemporaryDirectory() as tmp:
            sealed = Path(tmp) / 'dark-state/ucdp-summary.sealed'
            sealed.parent.mkdir()
            sealed.write_bytes(sealed_bytes)
            output = io.StringIO()
            with patch.dict(c.os.environ, {'UCDP_API_KEY': wrong_token}, clear=True), \
                    patch.object(c, 'Path', side_effect=lambda name: Path(tmp) / name), \
                    patch.object(c.subprocess, 'run', return_value=type('Result', (), {'stdout': b''})()), \
                    patch('sys.stdout', output), patch.object(c, 'safe_collect') as collect:
                self.assertEqual(c.main(), 1)
                collect.assert_not_called()
            self.assertEqual(sealed.read_bytes(), sealed_bytes)
            self.assertFalse((Path(tmp) / 'product-data/ucdp-conflict-summary.json').exists())
            self.assertIn('status=state_key_changed requests=0', output.getvalue())
            self.assertNotIn(original_token, output.getvalue())
            self.assertNotIn(wrong_token, output.getvalue())

    def test_restore_skips_run_without_artifact_and_downloads_by_id(self):
        branch = 'synthetic-branch'
        def artifact(i, expired=False, other_branch=False):
            return dict(id=i, name=restore.NAME, expired=expired,
                        expires_at='2099-01-01T00:00:00Z', created_at=f'2026-01-{i:02}T00:00:00Z',
                        workflow_run=dict(id=i, head_branch='other' if other_branch else branch))
        artifacts = [artifact(1), artifact(2, expired=True), artifact(3, other_branch=True)]
        calls = []
        def api(path):
            calls.append(path)
            if '/actions/artifacts?' in path:
                return dict(artifacts=artifacts)
            if '/actions/runs/' in path:
                return dict(path='.github/workflows/ucdp-dark-collector.yml', head_branch=branch)
            self.fail('Latest run (which has no artifact) must not control restoration')
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('ucdp-summary.sealed', b'synthetic-ciphertext-not-source-data' * 2)
        def download(path):
            self.assertTrue(path.endswith('/artifacts/1/zip'))
            return archive.getvalue()
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'ucdp-summary.sealed'
            self.assertEqual(restore.restore('owner/repo', branch, api, download, dest), 1)
            self.assertTrue(dest.exists())

    def test_restore_no_artifact_first_run_or_known_chain(self):
        def api(prior):
            return lambda path: dict(artifacts=[]) if '/actions/artifacts?' in path else dict(workflow_runs=prior)
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'ucdp-summary.sealed'
            self.assertIsNone(restore.restore('owner/repo', 'branch', api([]), lambda p: self.fail('download called'), dest))
            with self.assertRaises(ValueError):
                restore.restore('owner/repo', 'branch', api([{'id': 42}]), lambda p: self.fail('download called'), dest)
            self.assertFalse(dest.exists())

    def test_restore_expired_only_and_wrong_branch_not_selected(self):
        a = dict(id=1, name=restore.NAME, expired=True, expires_at='2099-01-01T00:00:00Z',
                 created_at='2026-01-01T00:00:00Z', workflow_run=dict(head_branch='branch'))
        self.assertIsNone(restore.select_artifact([a], 'branch'))
        a['expired'] = False
        self.assertIsNone(restore.select_artifact([a], 'different'))

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
        self.assertIn('page=0', calls[0])
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
        rows = [dict(id=i, region='Africa', date_end='2025-12-02', low=1, best=1, high=1) for i in range(c.PAGE_SIZE)]
        def get(url, token):
            if 'page=1' in url:
                raise c.CollectionError('rate_error')
            return dict(TotalCount=c.PAGE_SIZE + 1, TotalPages=2, Result=rows)
        s = c.safe_collect(c.initial(), 'synthetic-secret-only', get)
        self.assertEqual(s['request_count'], 2)
        self.assertEqual(s['regions'], [])
        self.assertIsNone(s['window']['end'])

    def test_zero_based_complete_pagination(self):
        calls = []
        def get(url, token):
            calls.append(url)
            ids = range(c.PAGE_SIZE) if 'page=0' in url else [c.PAGE_SIZE]
            rows = [dict(id=i, region='Africa', date_end='2025-12-02', low=1, best=1, high=1) for i in ids]
            return dict(TotalCount=c.PAGE_SIZE + 1, TotalPages=2, Result=rows)
        s = c.safe_collect(c.initial(), 'synthetic-secret-only', get)
        self.assertEqual(s['status'], 'collected_historical_context')
        self.assertEqual(s['regions'][0]['event_count'], c.PAGE_SIZE + 1)
        self.assertEqual(len(calls), 2)
        self.assertIn('page=1', calls[-1])

    def test_missing_key_no_requests(self):
        s = c.safe_collect(c.initial(), '', lambda *a: self.fail('network called'))
        self.assertEqual(s['request_count'], 0)
        self.assertEqual(s['status'], 'missing_key')

    def test_documented_clarity_two_crossed_estimates_preserved(self):
        p = page()
        p['Result'][0].update(event_clarity=2, low=5, best=6, high=3)
        s = c.safe_collect(c.initial(), 'synthetic-secret-only', lambda *a: p)
        self.assertEqual(s['status'], 'collected_historical_context')
        self.assertEqual(s['regions'][0]['fatalities'], dict(low=5, best=6, high=3))
        self.assertEqual(s['regions'][0]['fatality_order_exceptions'], 1)

    def test_schema_fail_closed(self):
        for mutation in (lambda s: s.pop('display_allowed'), lambda s: s.update(display_allowed=True),
                         lambda s: s.update(dataset_version='guessed'), lambda s: s.update(request_count=5000)):
            s = c.initial()
            mutation(s)
            with self.assertRaises(c.CollectionError):
                c.validate(s)

    def test_filters_and_fatality_bounds(self):
        for change in (dict(date_end='2026-01-01'), dict(low=-1), dict(best='4'), dict(region='unexpected')):
            p = page()
            p['Result'][0].update(change)
            s = c.safe_collect(c.initial(), 'synthetic-secret-only', lambda *a: p)
            self.assertIsNone(s['retrieved_utc'])

    def test_crossed_source_estimates_flagged_without_imputation(self):
        p = page()
        p['Result'][0].update(event_clarity=1, low=2, best=4, high=3)
        s = c.safe_collect(c.initial(), 'synthetic-secret-only', lambda *a: p)
        self.assertEqual(s['regions'][0]['fatalities'], dict(low=2, best=4, high=3))
        self.assertEqual(s['regions'][0]['fatality_order_exceptions'], 1)

    @unittest.skipUnless(importlib.util.find_spec('cryptography'), 'dedicated UCDP workflow installs crypto dependency')
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
