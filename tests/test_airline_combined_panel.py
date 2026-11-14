import copy
import hashlib
import json
import unittest
from intelligence.airline_combined_panel import build
from intelligence.airline_quarterly import normalize, COMPANIES
from intelligence.airline_research_panel import CORPORATE
from intelligence.jet_fuel_history import SOURCE, SERIES

class CombinedPanelTests(unittest.TestCase):
    def setUp(self):
        self.raw={};companies=[]
        for symbol,cik in COMPANIES.items():
            facts={tag:{'units':{'USD':[dict(start=start,end=end,filed='2025-07-15',accn='0000027904-25-000001',form='10-Q',val=value) for start,end,value in [('2025-01-01','2025-03-31',values[0]),('2025-04-01','2025-06-30',values[1])]]}} for tag,values in [('Revenues',(100,100)),('OperatingIncomeLoss',(10,-5))]}
            raw=json.dumps({'cik':cik,'facts':{'us-gaap':facts}}).encode();self.raw[f'CIK{cik:010d}.json']=raw
            company=normalize(json.loads(raw),symbol,2025,2025)
            company.update(source_response_sha256=hashlib.sha256(raw).hexdigest(),source_url=f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json',input_mode='sec_api_response');companies.append(company)
        self.sec=dict(schema='amalgam.airline-quarterly.v1',companies=companies,requested_start_year=2025,requested_end_year=2025,publication_time_verified=False,predictive_advantage='not_established')
        self.fuel=dict(schema='amalgam.jet-fuel-history.v1',series=SERIES,source_url=SOURCE,unit='USD_per_gallon',frequency='monthly',publication_time_verified=False,predictive_advantage='not_established',requested_start='2025-01',requested_end='2025-06',retrieved_utc='2026-11-05T00:00:00Z',excluded=[],missing_months=[],observations=[{'period':f'2025-{m:02d}','value':2 if m<4 else 4} for m in range(1,7)])
        self.curated=json.loads(CORPORATE.read_text())

    def test_shared_exposure_not_independent_company_count(self):
        panel=build(self.fuel,self.sec,self.raw,self.curated)
        self.assertEqual(panel['complete_lagged_company_pairs'],2)
        self.assertEqual(panel['distinct_complete_fuel_quarters'],1)
        self.assertEqual(panel['rows'][0]['next_margin_percent'],-5)
        self.assertEqual(panel['rows'][1]['quarterly_spot_change_percent'],100)
        self.assertEqual(panel['complete_fuel_change_company_pairs'],0)
        self.assertTrue(all(not r['trading_eligible'] for r in panel['rows']))

    def test_missing_month_blocks_pair_and_change(self):
        self.fuel['observations'].pop(1);self.fuel['missing_months']=['2025-02']
        panel=build(self.fuel,self.sec,self.raw,self.curated)
        self.assertEqual(panel['complete_lagged_company_pairs'],0)
        self.assertIsNone(panel['rows'][0]['mean_spot_usd_per_gallon'])
        self.assertIsNone(panel['rows'][1]['quarterly_spot_change_percent'])

    def test_tampered_sec_input_rejected(self):
        bad=copy.deepcopy(self.sec);bad['companies'][0]['observations'][0]['operating_margin_percent']=999
        with self.assertRaises(ValueError):build(self.fuel,bad,self.raw,self.curated)
