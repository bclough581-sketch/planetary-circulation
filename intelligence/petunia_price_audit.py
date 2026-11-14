"""Read-only Petunia price inventory audit; no returns, credentials or holdout access."""
import argparse
import csv
from contextlib import closing
import hashlib
import json
import math
import sqlite3
from datetime import date
from pathlib import Path

SYMBOLS=('DAL','UAL','SPY')


def audit(database, output_dir):
    database=Path(database).resolve();output_dir=Path(output_dir).resolve()
    if not database.is_file():raise ValueError('database does not exist')
    if 'holdout' in database.name.lower():raise ValueError('protected holdout databases are not supported')
    if output_dir==database.parent or database.parent in output_dir.parents:raise ValueError('output must be isolated from the source directory')
    records=[];summaries=[];dates={};flags=[]
    with closing(sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)) as connection:
        connection.execute('pragma query_only=on');connection.execute('begin')
        for symbol in SYMBOLS:
            rows=connection.execute('select ticker,date,open,high,low,close,volume from ohlcv where ticker=? order by date',(symbol,)).fetchall()
            invalid=[];seen=set();duplicates=[]
            for row in rows:
                day=row[1]
                if day in seen:duplicates.append(day)
                seen.add(day)
                try:
                    if date.fromisoformat(day).isoformat()!=day:raise ValueError()
                    prices=row[2:6];volume=row[6]
                    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<=0 for v in prices):raise ValueError()
                    op,high,low,close=prices
                    if not low<=min(op,close)<=max(op,close)<=high:raise ValueError()
                    if not isinstance(volume,(int,float)) or not math.isfinite(volume) or volume<0:raise ValueError()
                except (TypeError,ValueError):invalid.append(day)
            dates[symbol]=seen
            records.extend(rows)
            # Restrict to structural flags; never read account, order, outcome or token tables.
            symbol_flags=connection.execute('select date,kind from flags where ticker=? order by date,kind',(symbol,)).fetchall()
            flags.extend({'symbol':symbol,'date':day,'kind':kind} for day,kind in symbol_flags)
            summaries.append({'symbol':symbol,'rows':len(rows),'first_date':rows[0][1] if rows else None,
                              'last_date':rows[-1][1] if rows else None,'invalid_dates':invalid,'duplicate_dates':duplicates,
                              'structural_flag_count':len(symbol_flags)})
    benchmark=dates['SPY']
    for summary in summaries:
        own=dates[summary['symbol']]
        summary['missing_relative_to_spy_dates']=sorted(benchmark-own)
        summary['extra_relative_to_spy_dates']=sorted(own-benchmark)
    output_dir.mkdir(parents=True,exist_ok=True)
    snapshot=output_dir/'petunia-dal-ual-spy-snapshot.csv'
    with snapshot.open('w',newline='',encoding='utf-8') as stream:
        writer=csv.writer(stream);writer.writerow(['ticker','date','open','high','low','close','volume']);writer.writerows(records)
    report={'schema':'amalgam.petunia-price-readiness.v1','source_database':str(database),
            'access_mode':'sqlite_read_only_query_only_transaction','symbols':summaries,'structural_flags':flags,
            'common_dates':len(set.intersection(*(dates[symbol] for symbol in SYMBOLS))),
            'snapshot_sha256':hashlib.sha256(snapshot.read_bytes()).hexdigest(),
            'price_basis':'Petunia history documentation describes split-adjusted, not dividend-adjusted; vendor adjustment semantics not independently verified.',
            'ready_for_total_return_evaluation':False,'predictive_advantage':'not_established',
            'limitations':['Snapshot contains OHLCV only; no adjusted close, dividend or split-coefficient fields.',
                           'Matching SPY dates is a relative coverage check, not independent exchange-calendar validation.',
                           'No credentials, API calls, protected holdout data, return outcomes or strategy code were used.',
                           'No model or trading signal is validated by price coverage.',
                           'Provider entitlement, licensing and historical data revisions remain unverified.']}
    (output_dir/'petunia-price-readiness.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    lines=['AMALGAM — PETUNIA PRICE DATA READINESS',f"Common DAL/UAL/SPY dates: {report['common_dates']}",'Total-return evaluation ready: NO',report['price_basis']]
    for s in summaries:
        lines.append(f"{s['symbol']}: {s['rows']} rows, {s['first_date']} to {s['last_date']}; invalid {len(s['invalid_dates'])}; duplicates {len(s['duplicate_dates'])}; missing versus SPY {len(s['missing_relative_to_spy_dates'])}; structural flags {s['structural_flag_count']}")
    lines.extend(['','LIMITATIONS']+report['limitations'])
    lines.extend(['','NEXT INPUT','Documented dividend/split-adjusted close history for all three symbols from one consistent source. Alpha Vantage entitlement should be verified before any new subscription.','Snapshot checksum: '+report['snapshot_sha256']])
    (output_dir/'petunia-price-readiness.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('\n'.join(lines[:7]));return report


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--database',type=Path,required=True);parser.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args();audit(args.database,args.output_dir)


if __name__=='__main__':main()
