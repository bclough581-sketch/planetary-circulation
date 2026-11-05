import copy
import hashlib
import json
import unittest
from intelligence.airline_quarterly import normalize, COMPANIES
from intelligence.airline_quarterly_audit import audit_dataset, report
from intelligence.airline_research_panel import CORPORATE

class QuarterlyAuditTests(unittest.TestCase):
    def setUp(self):
        self.raw={};companies=[]
        for symbol,cik in COMPANIES.items():
            row=dict(start='2025-04-01',end='2025-06-30',filed='2025-07-15',accn='0000027904-25-000001',form='10-Q',val=100)
            payload={'cik':cik,'facts':{'us-gaap':{tag:{'units':{'USD':[{**row,'val':value}]}} for tag,value in [('Revenues',100),('OperatingIncomeLoss',-5)]}}}
            raw=json.dumps(payload).encode();self.raw[f'CIK{cik:010d}.json']=raw
            company=normalize(payload,symbol,2025,2025)
            company.update(source_response_sha256=hashlib.sha256(raw).hexdigest(),source_url=f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json',input_mode='sec_api_response')
            companies.append(company)
        self.dataset=dict(schema='amalgam.airline-quarterly.v1',companies=companies,requested_start_year=2025,requested_end_year=2025,publication_time_verified=False,predictive_advantage='not_established')
        self.curated=json.loads(CORPORATE.read_text())

    def test_reproduction_and_visible_disagreement(self):
        audit=audit_dataset(self.dataset,self.raw,self.curated)
        self.assertEqual(audit['direct_quarters'],2)
        self.assertEqual(audit['issuer_matches'],0)
        self.assertEqual(len(audit['issuer_comparisons']),1)
        self.assertNotEqual(audit['issuer_comparisons'][0]['sec_minus_issuer_usd_millions']['revenue'],0)
        self.assertIn('not independently authenticate',report(audit))

    def test_altered_raw_and_normalized_data_rejected(self):
        bad=copy.deepcopy(self.dataset);bad['companies'][0]['observations'][0]['operating_margin_percent']=9
        with self.assertRaises(ValueError):audit_dataset(bad,self.raw,self.curated)
        badraw={**self.raw,'CIK0000027904.json':b'{}'}
        with self.assertRaises(ValueError):audit_dataset(self.dataset,badraw,self.curated)

    def test_source_and_claims_rejected(self):
        for changes in ({'publication_time_verified':True},{'companies':[]}):
            with self.assertRaises(ValueError):audit_dataset({**self.dataset,**changes},self.raw,self.curated)
        bad=copy.deepcopy(self.dataset);bad['companies'][0]['source_url']='https://example.com'
        with self.assertRaises(ValueError):audit_dataset(bad,self.raw,self.curated)
