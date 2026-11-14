"""Join reproduced SEC outcomes with complete EIA fuel quarters; descriptive only."""
import argparse
import hashlib
import json
from pathlib import Path
from .airline_quarterly import COMPANIES
from .airline_quarterly_audit import audit_dataset
from .airline_research_panel import build as validate_fuel, CORPORATE
from .verify_research_artifact import _parse_json


def build(fuel, sec, raw_inputs, curated):
    audit = audit_dataset(sec, raw_inputs, curated)
    validate_fuel(fuel, curated)
    prices = {row['period']:row['value'] for row in fuel['observations']}
    def quarter_months(year, quarter):
        return [f'{year}-{(quarter-1)*3+i:02d}' for i in (1,2,3)]
    def mean(months):
        return sum(prices[m] for m in months)/3 if all(m in prices for m in months) else None
    rows = []
    for company in sec['companies']:
        outcomes = {r['end'][:4]+'Q'+str((int(r['end'][5:7])-1)//3+1):r for r in company['observations']}
        for period, outcome in sorted(outcomes.items()):
            year, q = int(period[:4]),int(period[-1])
            required = quarter_months(year,q)
            previous = quarter_months(year,q-1) if q>1 else quarter_months(year-1,4)
            next_period = f'{year}Q{q+1}' if q<4 else f'{year+1}Q1'
            next_row = outcomes.get(next_period)
            current_mean, previous_mean = mean(required),mean(previous)
            reasons = ([] if current_mean is not None else ['missing_fuel_months'])+([] if next_row else ['missing_next_quarter_outcome'])
            margin = lambda r:100*r['metrics']['operating_income_usd']['value']/r['metrics']['revenue_usd']['value']
            rows.append({'symbol':company['symbol'],'period':period,
                'mean_spot_usd_per_gallon':current_mean,
                'previous_mean_spot_usd_per_gallon':previous_mean,
                'quarterly_spot_change_percent':None if current_mean is None or previous_mean is None else 100*(current_mean/previous_mean-1),
                'missing_fuel_months':[m for m in required if m not in prices],
                'missing_previous_fuel_months':[m for m in previous if m not in prices],
                'operating_margin_percent':margin(outcome),
                'next_period':next_period,'next_margin_percent':None if next_row is None else margin(next_row),
                'company_filing_index_url':outcome['filing_index_url'],
                'company_filed_date_claim':outcome['filed_date_claim'],
                'next_filing_index_url':None if next_row is None else next_row['filing_index_url'],
                'next_filed_date_claim':None if next_row is None else next_row['filed_date_claim'],
                'pair_complete':not reasons,'pair_exclusions':reasons,'trading_eligible':False})
    complete = [row for row in rows if row['pair_complete']]
    change_pairs = [row for row in complete if row['quarterly_spot_change_percent'] is not None]
    return {'schema':'amalgam.airline-combined-panel.v1','rows':rows,
            'company_count':len(sec['companies']), 'direct_outcome_quarters':len(rows),
            'complete_lagged_company_pairs':len(complete),
            'distinct_complete_fuel_quarters':len({r['period'] for r in complete}),
            'complete_fuel_change_company_pairs':len(change_pairs),
            'distinct_fuel_change_quarters':len({r['period'] for r in change_pairs}),
            'source_audit':audit,'fuel_source_url':fuel['source_url'],
            'fuel_retrieved_utc_claim':fuel['retrieved_utc'],
            'trading_eligible_rows':0,'evaluation_status':'blocked','predictive_advantage':'not_established',
            'blocking_reasons':[
                'Reporting-period alignment is not decision-time availability; current-quarter financial reports may be filed during the following quarter.',
                'Current SEC facts may reflect revisions; retained filing claims are not authenticated original availability.',
                'Repeated fuel exposure across airlines is shared evidence, not independent shocks; quarters are serially dependent.',
                'Two selected airlines, changing XBRL concept coverage, and missing direct quarters limit representativeness.',
                'Monthly spot means and their changes are not realized company fuel prices or consumption.',
                'No registered hypothesis, controls, untouched holdout, market-return benchmark or transaction costs.'
            ]}


def report(panel):
    lines=['AMALGAM COMBINED AIRLINE PANEL — DESCRIPTIVE ONLY',
           f"Companies: {panel['company_count']} | direct outcome quarters: {panel['direct_outcome_quarters']}",
           f"Complete company pairs: {panel['complete_lagged_company_pairs']} | distinct fuel quarters: {panel['distinct_complete_fuel_quarters']}",
           f"Fuel-change company pairs: {panel['complete_fuel_change_company_pairs']} | distinct change quarters: {panel['distinct_fuel_change_quarters']}",
           'Trading eligible: 0 | evaluation blocked | predictive advantage not established',
           'Means: equal-weight average of three monthly spot benchmarks. Gaps remain missing.',
           'Company | Quarter | Fuel mean USD/gal | Fuel change % | Next quarter margin % | Exclusions']
    for r in panel['rows']:
        lines.append(f"{r['symbol']} | {r['period']} | {r['mean_spot_usd_per_gallon']} | {r['quarterly_spot_change_percent']} | {r['next_margin_percent']} | {','.join(r['pair_exclusions']) or 'none (descriptive only)'}")
    lines.extend(['','EVALUATION BLOCKERS']+panel['blocking_reasons'])
    lines.append('Internal reproduction does not authenticate historical availability or causal effects.')
    return '\n'.join(lines)+'\n'


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--directory',type=Path,required=True);parser.add_argument('--verify',action='store_true')
    args=parser.parse_args();root=args.directory
    names=['airline-quarterly.json','jet-fuel-history.json','delta-quarterly-curated.json']+[f'CIK{cik:010d}.json' for cik in COMPANIES.values()]
    contents={name:(root/name).read_bytes() for name in names}
    if any(len(data)>20_000_000 for data in contents.values()):raise ValueError('input too large')
    panel=build(_parse_json(contents['jet-fuel-history.json']),_parse_json(contents['airline-quarterly.json']),contents,_parse_json(contents['delta-quarterly-curated.json']))
    generated={'combined-airline-panel.json':(json.dumps(panel,indent=2,allow_nan=False)+'\n').encode(),
               'combined-airline-report.txt':report(panel).encode()}
    manifest={'schema':'amalgam.airline-combined-integrity.v1','files':{name:hashlib.sha256(data).hexdigest() for name,data in {**contents,**generated}.items()}}
    if args.verify:
        for name,data in generated.items():
            if (root/name).read_bytes()!=data:raise ValueError('reproduction mismatch: '+name)
        if _parse_json((root/'combined-airline-manifest.json').read_bytes())!=manifest:raise ValueError('manifest mismatch')
        print('Combined panel, report and retained source inputs reproduce.')
    else:
        for name,data in generated.items():(root/name).write_bytes(data)
        (root/'combined-airline-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('Company pairs:',panel['complete_lagged_company_pairs'],'| distinct fuel quarters:',panel['distinct_complete_fuel_quarters'],'| trading eligible: 0')


if __name__=='__main__':main()
