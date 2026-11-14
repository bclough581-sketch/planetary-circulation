"""Validate adjusted price snapshots against retained reference sessions; no outcome returns."""
import argparse
import csv
import hashlib
import json
import math
from datetime import date, datetime
from pathlib import Path
from .verify_research_artifact import _parse_json

SYMBOLS=('DAL','UAL','SPY')
FIELDS=('open','high','low','close','adjusted_close','volume','dividend_amount','split_coefficient')
FACTOR_TOLERANCE=0.00001


def audit_prices(payload, sessions):
    if payload.get('schema')!='amalgam.alpha-vantage-entitlement-sample.v1' or payload.get('symbol') not in SYMBOLS or payload.get('endpoint')!='TIME_SERIES_DAILY_ADJUSTED':raise ValueError('unsupported price input')
    expected=[r['date'] for r in sessions]
    if not expected or expected!=sorted(set(expected)):raise ValueError('invalid reference sessions')
    for session in sessions:
        if date.fromisoformat(session['date']).isoformat()!=session['date']:raise ValueError('invalid session date')
        op,cl=(datetime.fromisoformat(session[key].replace('Z','+00:00')) for key in ('open_utc','close_utc'))
        if op.tzinfo is None or cl.tzinfo is None or not op<cl or op.date().isoformat()!=session['date'] or cl.date().isoformat()!=session['date']:raise ValueError('invalid session timestamps')
    rows=payload['observations'];previous='';by={}
    for row in rows:
        day=row['date']
        if date.fromisoformat(day).isoformat()!=day or day<=previous:raise ValueError('invalid, duplicate or unordered price date')
        for name in FIELDS:
            value=row[name]
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError('invalid numeric field')
            if value<0 or (name not in ('volume','dividend_amount') and value==0):raise ValueError('invalid field range')
        if not row['low']<=min(row['open'],row['close'])<=max(row['open'],row['close'])<=row['high']:raise ValueError('invalid OHLC bounds')
        previous=day;by[day]=row
    wanted=set(expected);available={day for day in by if expected[0]<=day<=expected[-1]}
    missing=sorted(wanted-available);extra=sorted(available-wanted)
    mismatches=[];total_return_mismatches=[];ambiguous=[];checked=0;cash_events=0;split_events=0
    for before,after in zip(expected,expected[1:]):
        if before not in by or after not in by:continue
        prior,current=by[before],by[after]
        split,dividend=current['split_coefficient'],current['dividend_amount']
        cash_events+=dividend>0;split_events+=split!=1
        if (split!=1 and dividend!=0) or dividend>=prior['close']:
            ambiguous.append(after);continue
        # Diagnostic back-adjustment convention, not independently certified total returns.
        expected_factor=split/(1-dividend/prior['close'])
        actual_factor=(current['adjusted_close']/current['close'])/(prior['adjusted_close']/prior['close'])
        error=abs(actual_factor/expected_factor-1);checked+=1
        if error>FACTOR_TOLERANCE:mismatches.append({'date':after,'relative_factor_error':error})
        # Dividend reinvested at the ex-date close: adjusted-close growth must
        # reconcile to (current raw close + cash dividend) / prior raw close.
        # This checks adjustment identity only; no strategy or forward return is computed.
        identity_factor=split*(1+dividend/current['close'])
        identity_error=abs(actual_factor/identity_factor-1)
        if identity_error>FACTOR_TOLERANCE:total_return_mismatches.append({'date':after,'relative_factor_error':identity_error})
    return {'symbol':payload['symbol'],'sessions_expected':len(expected),'sessions_present':len(wanted&available),
            'missing_sessions':missing,'unexpected_dates':extra,'factor_checks':checked,
            'cash_distribution_events_checked':cash_events,'split_events_checked':split_events,
            'factor_tolerance':FACTOR_TOLERANCE,'prior_close_backadjustment_mismatches':mismatches,'total_return_identity_mismatches':total_return_mismatches,'ambiguous_action_dates':ambiguous,
            'calendar_coverage_passed':not(missing or extra),
            'adjustment_diagnostic_passed':checked>0 and not(total_return_mismatches or ambiguous),
            'independent_adjustment_authentication':False}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--price-dir',type=Path,required=True);parser.add_argument('--calendar-dir',type=Path,required=True);parser.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
    calendar=args.calendar_dir/'reference-sessions.csv'
    with calendar.open(encoding='utf-8',newline='') as f:sessions=list(csv.DictReader(f))
    metadata=_parse_json((args.calendar_dir/'calendar-metadata.json').read_bytes())
    reports=[];snapshots={};output_rows=[]
    for symbol in SYMBOLS:
        p=args.price_dir/f'alpha-vantage-{symbol.lower()}-full-adjusted-sample.json'
        raw=p.read_bytes();payload=_parse_json(raw);result=audit_prices(payload,sessions)
        if result['symbol']!=symbol:raise ValueError('price filename/symbol mismatch')
        reports.append(result);snapshots[p.name]=hashlib.sha256(raw).hexdigest()
        reference={r['date']:r for r in sessions}
        for row in payload['observations']:
            if row['date'] in reference:
                output_rows.append([symbol,row['date'],reference[row['date']]['close_utc'],row['close'],row['adjusted_close'],row['dividend_amount'],row['split_coefficient']])
    csv_path=args.output_dir/'daily-research-prices.csv'
    with csv_path.open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f);w.writerow(['symbol','date','reference_close_utc','vendor_raw_close','vendor_adjusted_close','dividend_amount','split_coefficient']);w.writerows(output_rows)
    report={'schema':'amalgam.daily-price-quality.v1','calendar_metadata':metadata,'calendar_sha256':hashlib.sha256(calendar.read_bytes()).hexdigest(),
            'symbols':reports,'input_sha256':snapshots,'dataset_sha256':hashlib.sha256(csv_path.read_bytes()).hexdigest(),
            'ready_for_predictive_evaluation':False,'predictive_advantage':'not_established',
            'limits':['Calendar is an independent third-party implementation, not exchange certification.',
                      'Both prior-close back-adjustment and ex-date-close dividend-reinvestment identities are reported; their conventions can differ. Passing an identity does not independently authenticate vendor methodology.',
                      'No strategy returns, test outcomes or model performance were calculated.',
                      'Two vendor raw-close discrepancies versus Petunia remain retained in the separate comparison; sources were not blended.',
                      'Public/commercial redistribution rights, signal availability, and a locked evaluation protocol remain unresolved.']}
    (args.output_dir/'daily-price-quality.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    lines=['AMALGAM DAILY PRICE QUALITY — READINESS ONLY',f"Reference sessions: {len(sessions)}; calendar {metadata['library']} {metadata['version']} {metadata['calendar']}"]
    for r in reports:lines.append(f"{r['symbol']}: {r['sessions_present']}/{r['sessions_expected']} sessions; missing {len(r['missing_sessions'])}; unexpected {len(r['unexpected_dates'])}; dividend-reinvestment identity mismatches {len(r['total_return_identity_mismatches'])}/{r['factor_checks']}; prior-close convention mismatches {len(r['prior_close_backadjustment_mismatches'])}; ambiguous actions {len(r['ambiguous_action_dates'])}")
    lines.extend(['','LIMITATIONS']+report['limits']);lines.append('Dataset is local research material; do not publish provider prices without verified rights.')
    (args.output_dir/'daily-price-quality.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8');print('\n'.join(lines[:5]))


if __name__=='__main__':main()
