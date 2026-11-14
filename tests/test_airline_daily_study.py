import json
import unittest
from intelligence.airline_daily_study import build, SPEC
from intelligence.jet_fuel_history import SERIES

class DailyAirlineTests(unittest.TestCase):
    def rows(self):
        return [dict(series=SERIES,units='$/GAL',period=day,value=value) for day,value in zip(['2025-01-02','2025-01-03','2025-01-06','2025-01-07','2025-01-08','2025-01-09'],[2,2.1,2.2,2.3,2.4,3])]
    def build(self,rows,total=None):
        return build('2025-01-01','2025-01-10',key='test',fetch=lambda _: {'response':{'data':rows,'total':len(rows) if total is None else total}})
    def test_irregular_observation_intervals_and_no_eligibility(self):
        result=self.build(self.rows())
        self.assertEqual(len(result['candidates']),1)
        self.assertEqual(result['candidates'][0]['lookback_calendar_days'],7)
        self.assertEqual(result['candidates'][0]['change_percent'],50)
        self.assertFalse(result['candidates'][0]['trading_eligible'])
        self.assertEqual(result['unobserved_calendar_dates'],4)
    def test_missing_and_conflicting_prices(self):
        rows=self.rows();rows[1]['value']=None
        self.assertEqual(len(self.build(rows)['candidates']),0)
        rows=self.rows()+[{**self.rows()[0],'value':9}]
        with self.assertRaises(ValueError):self.build(rows)
    def test_wrong_units_and_truncation(self):
        rows=self.rows();rows[0]['units']='USD/barrel'
        with self.assertRaises(ValueError):self.build(rows)
        with self.assertRaises(ValueError):self.build(self.rows(),7)
    def test_draft_horizons(self):
        spec=json.loads(SPEC.read_text())
        self.assertEqual(spec['status'],'draft_not_preregistered')
        self.assertEqual(spec['primary_horizon_trading_sessions'],5)
        self.assertEqual(spec['secondary_horizon_trading_sessions'],10)
