import hashlib
from contextlib import closing
import sqlite3
import tempfile
import unittest
from pathlib import Path
from intelligence.petunia_price_audit import audit

class PetuniaReadinessTests(unittest.TestCase):
    def make_db(self,root):
        source=root/'source';source.mkdir();db=source/'ohlcv.sqlite'
        with closing(sqlite3.connect(db)) as c, c:
            c.execute('create table ohlcv(ticker text,date text,open real,high real,low real,close real,volume real)')
            c.execute('create table flags(ticker text,date text,kind text)')
            for symbol in ('DAL','UAL','SPY'):
                c.execute('insert into ohlcv values(?,?,?,?,?,?,?)',(symbol,'2025-01-02',10,12,9,11,100))
        return db

    def test_read_only_snapshot_and_no_return_eligibility(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);db=self.make_db(root);before=hashlib.sha256(db.read_bytes()).hexdigest()
            result=audit(db,root/'out')
            self.assertEqual(hashlib.sha256(db.read_bytes()).hexdigest(),before)
            self.assertEqual(result['common_dates'],1)
            self.assertFalse(result['ready_for_total_return_evaluation'])
            self.assertEqual(len((root/'out'/'petunia-dal-ual-spy-snapshot.csv').read_text().splitlines()),4)

    def test_invalid_prices_and_relative_gaps_visible(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);db=self.make_db(root)
            with closing(sqlite3.connect(db)) as c, c:
                c.execute("update ohlcv set high=1 where ticker='DAL'")
                c.execute("delete from ohlcv where ticker='UAL'")
            result=audit(db,root/'out')
            self.assertEqual(result['symbols'][0]['invalid_dates'],['2025-01-02'])
            self.assertEqual(result['symbols'][1]['missing_relative_to_spy_dates'],['2025-01-02'])
            self.assertEqual(result['common_dates'],0)

    def test_source_and_holdout_outputs_protected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);db=self.make_db(root)
            with self.assertRaises(ValueError):audit(db,db.parent/'out')
            protected=db.with_name('holdout.sqlite');protected.write_bytes(db.read_bytes())
            with self.assertRaises(ValueError):audit(protected,root/'out')
