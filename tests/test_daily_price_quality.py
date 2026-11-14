import copy
import unittest
from intelligence.daily_price_quality import audit_prices

class DailyPriceQualityTests(unittest.TestCase):
    def setUp(self):
        self.sessions=[{'date':d,'open_utc':d+'T14:30:00+00:00','close_utc':d+'T21:00:00+00:00'} for d in ('2025-01-02','2025-01-03')]
        self.payload={'schema':'amalgam.alpha-vantage-entitlement-sample.v1','symbol':'SPY','endpoint':'TIME_SERIES_DAILY_ADJUSTED',
          'observations':[dict(date=d,open=100,high=100,low=100,close=100,adjusted_close=100,volume=10,dividend_amount=0,split_coefficient=1) for d in ('2025-01-02','2025-01-03')]}

    def test_dividend_identity_and_distinct_convention(self):
        row=self.payload['observations'][1];row.update(open=102,high=102,low=102,close=102,adjusted_close=103,dividend_amount=1)
        result=audit_prices(self.payload,self.sessions)
        self.assertEqual(result['total_return_identity_mismatches'],[])
        self.assertEqual(len(result['prior_close_backadjustment_mismatches']),1)
        self.assertTrue(result['adjustment_diagnostic_passed'])
        self.assertFalse(result['independent_adjustment_authentication'])

    def test_split_identity(self):
        self.payload['observations'][0]['adjusted_close']=50
        self.payload['observations'][1].update(open=50,high=50,low=50,close=50,adjusted_close=50,split_coefficient=2)
        self.assertTrue(audit_prices(self.payload,self.sessions)['adjustment_diagnostic_passed'])

    def test_corrupted_adjustment_detected(self):
        self.payload['observations'][1]['adjusted_close']=110
        result=audit_prices(self.payload,self.sessions)
        self.assertFalse(result['adjustment_diagnostic_passed'])
        self.assertEqual(len(result['total_return_identity_mismatches']),1)

    def test_missing_session_not_filled(self):
        self.payload['observations'].pop()
        result=audit_prices(self.payload,self.sessions)
        self.assertFalse(result['calendar_coverage_passed'])
        self.assertEqual(result['missing_sessions'],['2025-01-03'])

    def test_duplicates_bad_fields_and_misaligned_calendar_rejected(self):
        bad=copy.deepcopy(self.payload);bad['observations'].append(bad['observations'][0])
        with self.assertRaises(ValueError):audit_prices(bad,self.sessions)
        for value in (True,float('nan'),0):
            bad=copy.deepcopy(self.payload);bad['observations'][0]['adjusted_close']=value
            with self.assertRaises(ValueError):audit_prices(bad,self.sessions)
        self.sessions[0]['close_utc']='2025-01-03T21:00:00+00:00'
        with self.assertRaises(ValueError):audit_prices(self.payload,self.sessions)
