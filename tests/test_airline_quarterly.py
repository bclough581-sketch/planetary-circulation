import unittest
from intelligence.airline_quarterly import normalize

class QuarterlyTests(unittest.TestCase):
    def payload(self):
        row = dict(start='2025-04-01', end='2025-06-30', filed='2025-07-15', accn='0000027904-25-000001', form='10-Q', val=100)
        return {'cik':27904,'facts':{'us-gaap':{tag:{'units':{'USD':[{**row,'val':value}]}} for tag,value in [('Revenues',100),('OperatingIncomeLoss',-5)]}}}

    def test_pair_and_loss_margin(self):
        result=normalize(self.payload(),'DAL',2025,2025)
        self.assertEqual(result['observations'][0]['operating_margin_percent'],-5)
        self.assertEqual(result['missing_quarters'],['2025Q1','2025Q3','2025Q4'])

    def test_ytd_not_quarter(self):
        p=self.payload()
        for concept in p['facts']['us-gaap'].values():
            concept['units']['USD'][0]['start']='2025-01-01'
        self.assertEqual(normalize(p,'DAL',2025,2025)['observations'],[])

    def test_same_filing_required(self):
        p=self.payload();p['facts']['us-gaap']['Revenues']['units']['USD'][0]['accn']='0000027904-25-000002'
        self.assertEqual(normalize(p,'DAL',2025,2025)['observations'],[])

    def test_conflict_and_identity(self):
        p=self.payload();rows=p['facts']['us-gaap']['Revenues']['units']['USD'];rows.append({**rows[0],'val':101})
        with self.assertRaises(ValueError):normalize(p,'DAL',2025,2025)
        with self.assertRaises(ValueError):normalize(self.payload(),'UAL',2025,2025)
