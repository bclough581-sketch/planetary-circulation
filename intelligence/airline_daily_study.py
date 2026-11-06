"""Daily jet-fuel observations and unverified short-horizon research candidates."""
import argparse
import json
import math
import os
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from .jet_fuel_history import SERIES, ENDPOINT

SOURCE='https://www.eia.gov/dnav/pet/hist/EER_EPJK_PF4_RGC_DPGD.htm'
SPEC=Path(__file__).parent/'data'/'airline-daily-study.json'


def build(start,end,key=None,fetch=None):
    begin,finish=date.fromisoformat(start),date.fromisoformat(end)
    if begin>finish or (finish-begin).days>4500:raise ValueError('invalid or excessive date range')
    key=key or os.environ.get('EIA_API_KEY','').strip()
    if not key:raise ValueError('EIA_API_KEY required')
    query={'api_key':key,'frequency':'daily','data[0]':'value','facets[series][]':SERIES,'start':start,'end':end,
           'sort[0][column]':'period','sort[0][direction]':'asc','length':'5000'}
    if fetch is None:
        def fetch(url):
            try:
                with urllib.request.urlopen(url,timeout=45) as response:return json.load(response)
            except Exception:raise ValueError('EIA daily request failed') from None
    response=fetch(ENDPOINT+'?'+urllib.parse.urlencode(query)).get('response',{})
    rows=response.get('data');total=str(response.get('total',''))
    if not isinstance(rows,list) or not total.isdigit() or int(total)!=len(rows):raise ValueError('missing or truncated EIA daily response')
    prices={};excluded=[]
    for row in rows:
        if row.get('series')!=SERIES or row.get('units') not in ('Dollars per Gallon','$/GAL'):raise ValueError('unexpected source or units')
        day=date.fromisoformat(row['period'])
        if day.isoformat()!=row['period'] or not begin<=day<=finish:raise ValueError('unexpected observation date')
        raw=row.get('value')
        try:value=float(raw)
        except (TypeError,ValueError):value=float('nan')
        if isinstance(raw,bool) or not math.isfinite(value) or value<=0:
            excluded.append({'date':day.isoformat(),'reason':'missing_or_invalid_price'});continue
        if day in prices and prices[day]!=value:raise ValueError('conflicting daily observation')
        prices[day]=value
    if not prices:raise ValueError('no valid daily prices')
    observations=[{'date':day.isoformat(),'usd_per_gallon':prices[day]} for day in sorted(prices)]
    candidates=[]
    for index,row in enumerate(observations[5:],start=5):
        previous=observations[index-5]
        candidates.append({'observation_date':row['date'],'lookback_observation_date':previous['date'],
            'lookback_calendar_days':(date.fromisoformat(row['date'])-date.fromisoformat(previous['date'])).days,
            'change_percent':100*(row['usd_per_gallon']/previous['usd_per_gallon']-1),
            'availability_verified':False,'trading_eligible':False})
    return {'schema':'amalgam.jet-fuel-daily-study.v1','source_url':SOURCE,'series':SERIES,
            'requested_start':start,'requested_end':end,'retrieved_utc':datetime.now(timezone.utc).isoformat(),
            'unit':'USD_per_gallon','observations':observations,'excluded':excluded,'candidates':candidates,
            'unobserved_calendar_dates':(finish-begin).days+1-len(prices),
            'calendar_warning':'Unobserved calendar dates include weekends and holidays; no exchange-session completeness is asserted.',
            'trading_eligible_count':0,'predictive_advantage':'not_established',
            'warning':'Five reported-observation intervals are not necessarily five trading sessions. Observation dates are not publication times. No prices or outcomes are forward-filled; candidates are unverified context, not trade signals.'}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--start',required=True);parser.add_argument('--end',required=True);parser.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args();result=build(args.start,args.end);args.output_dir.mkdir(parents=True,exist_ok=True)
    (args.output_dir/'jet-fuel-daily.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    (args.output_dir/'airline-daily-study.json').write_bytes(SPEC.read_bytes())
    lines=['AMALGAM DAILY AIRLINE STUDY — CANDIDATE CONTEXT ONLY',f"Daily observations: {len(result['observations'])}; five-observation changes: {len(result['candidates'])}",
           'Decision horizon: 5 trading sessions primary, 10 secondary.','Trading eligible: 0 | predictive advantage not established',result['source_url'],result['calendar_warning'],result['warning'],
           'BLOCKERS: verified release/availability evidence; licensed adjusted daily DAL/UAL/SPY prices; exchange calendar; protocol lock and untouched holdout. No return outcomes or evaluation have been generated.']
    (args.output_dir/'daily-readiness.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(lines[1]);print('Return evaluation blocked; trading eligible: 0')


if __name__=='__main__':main()
