import copy
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from intelligence.airline_research_panel import build, report, main, CORPORATE
from intelligence.jet_fuel_history import SOURCE, SERIES

class AirlinePanelTests(unittest.TestCase):
    def setUp(self):
        self.company=json.loads(CORPORATE.read_text())
        self.fuel=dict(schema='amalgam.jet-fuel-history.v1',series=SERIES,source_url=SOURCE,unit='USD_per_gallon',frequency='monthly',publication_time_verified=False,predictive_advantage='not_established',requested_start='2025-01',requested_end='2025-12',retrieved_utc='2026-11-05T00:00:00Z',excluded=[],missing_months=[],observations=[{'period':f'2025-{m:02d}','value':float(m)} for m in range(1,13)])

    def test_complete_and_missing_outcomes(self):
        panel=build(self.fuel,self.company)
        self.assertEqual(panel['complete_lagged_pairs'],2)
        self.assertEqual(panel['rows'][3]['mean_spot_usd_per_gallon'],2)
        self.assertEqual(panel['rows'][5]['pair_exclusions'],['missing_next_quarter_outcome'])
        self.assertTrue(all(not r['trading_eligible'] for r in panel['rows']))
        self.assertIn('evaluation',report(panel).lower())

    def test_gap_blocks_mean_without_zero(self):
        self.fuel['observations'].pop(1);self.fuel['missing_months']=['2025-02']
        panel=build(self.fuel,self.company)
        self.assertIsNone(panel['rows'][3]['mean_spot_usd_per_gallon'])
        self.assertEqual(panel['complete_lagged_pairs'],1)

    def test_invalid_inputs(self):
        for change in ({'unit':'USD_per_barrel'},{'publication_time_verified':True},{'missing_months':['2025-01']}):
            with self.assertRaises(ValueError):build({**self.fuel,**change},self.company)
        for value in (True,float('nan'),float('inf'),0):
            bad=copy.deepcopy(self.fuel);bad['observations'][0]['value']=value
            with self.assertRaises(ValueError):build(bad,self.company)
        bad=copy.deepcopy(self.fuel);bad['observations'].append(bad['observations'][0])
        with self.assertRaises(ValueError):build(bad,self.company)
        bad=copy.deepcopy(self.company);bad['observations'][0]['revenue']=1
        with self.assertRaises(ValueError):build(self.fuel,bad)

    def test_viewer_evidence_and_alignment_parity(self):
        html=Path('convergence-research.html').read_text(encoding='utf-8')
        embedded=re.search(r'const deltaQuarterlyEvidence=(.*?);\s*function renderCuratedQuarters',html,re.S).group(1)
        self.assertEqual(json.loads(embedded),self.company)
        # Shared example used by the browser tests: 2,3,4 means 3, then Q2 margin.
        self.fuel.update(requested_end='2025-03',observations=[{'period':f'2025-{m:02d}','value':m+1} for m in (1,2,3)])
        row=build(self.fuel,self.company)['rows'][3]
        self.assertEqual(row['mean_spot_usd_per_gallon'],3)
        self.assertAlmostEqual(row['next_margin_percent'],100*2102/16648)

    def test_round_trip_and_tampering(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'jet-fuel-history.json').write_text(json.dumps(self.fuel))
            (root/'delta-quarterly-curated.json').write_bytes(CORPORATE.read_bytes())
            with patch('sys.argv',['panel','--directory',folder]):main()
            with patch('sys.argv',['panel','--directory',folder,'--verify']):main()
            (root/'airline-research-report.txt').write_text('unsupported result')
            with patch('sys.argv',['panel','--directory',folder,'--verify']), self.assertRaises(ValueError):main()
