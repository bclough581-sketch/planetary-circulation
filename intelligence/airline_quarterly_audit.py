"""Reproduce SEC quarterly outcomes and reconcile overlapping issuer evidence."""
import argparse
import hashlib
import json
from pathlib import Path
from .airline_quarterly import normalize, COMPANIES
from .airline_research_panel import CORPORATE
from .verify_research_artifact import _parse_json


def audit_dataset(dataset, raw_inputs, curated):
    if (dataset.get('schema') != 'amalgam.airline-quarterly.v1'
        or dataset.get('publication_time_verified') is not False
        or dataset.get('predictive_advantage') != 'not_established'):
        raise ValueError('unsupported dataset claims')
    if curated != _parse_json(CORPORATE.read_bytes()):
        raise ValueError('issuer evidence differs from reviewed repository data')
    companies = dataset['companies']
    if len(companies) != len(COMPANIES) or {c['symbol'] for c in companies} != set(COMPANIES):
        raise ValueError('company coverage mismatch')
    summaries, comparisons = [], []
    for company in companies:
        symbol = company['symbol']; cik = COMPANIES[symbol]
        raw = raw_inputs[f'CIK{cik:010d}.json']
        if hashlib.sha256(raw).hexdigest() != company['source_response_sha256']:
            raise ValueError('retained SEC response checksum mismatch')
        expected = normalize(_parse_json(raw), symbol, dataset['requested_start_year'], dataset['requested_end_year'])
        for key, value in expected.items():
            if company.get(key) != value:
                raise ValueError('SEC normalization mismatch: '+symbol+' '+key)
        source = f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json'
        if company['source_url'] != source or company['input_mode'] not in ('sec_api_response','local_unverified_file'):
            raise ValueError('unsupported source identity')
        summaries.append({'symbol':symbol,'quarters':len(company['observations']),
                          'first_period_end':company['observations'][0]['end'] if company['observations'] else None,
                          'last_period_end':company['observations'][-1]['end'] if company['observations'] else None,
                          'missing_quarters':company['missing_quarters'], 'source_url':source,
                          'concepts':sorted({v['tag'] for row in company['observations'] for v in row['metrics'].values()})})
        if symbol != curated['symbol']:
            continue
        by_period={row['end'][:4]+'Q'+str((int(row['end'][5:7])-1)//3+1):row for row in company['observations']}
        for row in curated['observations']:
            if row['period'] not in by_period:
                continue
            sec=by_period[row['period']]
            differences={key:sec['metrics'][tag]['value']/1_000_000-row[key]
                         for key,tag in [('revenue','revenue_usd'),('operatingIncome','operating_income_usd')]}
            comparisons.append({'symbol':symbol,'period':row['period'],
                                'sec_minus_issuer_usd_millions':differences,
                                'match':all(value==0 for value in differences.values()),
                                'issuer_source_url':curated['sources'][row['source']],
                                'sec_filing_index_url':sec['filing_index_url']})
    return {'schema':'amalgam.airline-quarterly-audit.v1','companies':summaries,
            'direct_quarters':sum(c['quarters'] for c in summaries),'issuer_comparisons':comparisons,
            'issuer_matches':sum(row['match'] for row in comparisons),
            'trading_eligible_rows':0,'predictive_advantage':'not_established',
            'limitations':['Current API records may reflect revisions; earliest retained filing is not authenticated original availability.',
                           'A single selected revenue concept is used per company; taxonomy changes can leave historical gaps.',
                           'Only directly reported calendar quarters; no annual subtraction or gap filling.',
                           'No fuel-expense concept or independent realized fuel prices are collected by this SEC pipeline.',
                           'Two selected airlines are not a representative sector sample; no untouched holdout or stock-return test.']}


def report(audit):
    lines=['AMALGAM SEC QUARTERLY CORPUS — DESCRIPTIVE RESEARCH',
           f"Direct quarters: {audit['direct_quarters']}; issuer comparisons matching: {audit['issuer_matches']}/{len(audit['issuer_comparisons'])}",
           'Trading eligible: 0 | Predictive advantage: not established']
    for c in audit['companies']:
        lines.extend([f"{c['symbol']}: {c['quarters']} quarters, {c['first_period_end']} to {c['last_period_end']}",
                      'Concepts: '+', '.join(c['concepts']), 'Missing: '+', '.join(c['missing_quarters']), c['source_url']])
    lines.extend(['', 'ISSUER RECONCILIATION (SEC minus issuer, USD millions)'])
    for row in audit['issuer_comparisons']:
        lines.extend([row['symbol']+' '+row['period']+': '+str(row['sec_minus_issuer_usd_millions']),row['issuer_source_url'],row['sec_filing_index_url']])
    lines.extend(['','LIMITATIONS']+audit['limitations'])
    lines.append('Reproduction and internal checksums do not independently authenticate SEC origin or historical availability.')
    return '\n'.join(lines)+'\n'


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--directory',type=Path,required=True)
    parser.add_argument('--verify',action='store_true')
    args=parser.parse_args();root=args.directory
    names=['airline-quarterly.json','delta-quarterly-curated.json']+[f'CIK{cik:010d}.json' for cik in COMPANIES.values()]
    contents={name:(root/name).read_bytes() for name in names}
    if any(len(data)>20_000_000 for data in contents.values()):raise ValueError('input too large')
    audit=audit_dataset(_parse_json(contents[names[0]]),contents,_parse_json(contents[names[1]]))
    generated={'quarterly-audit.json':(json.dumps(audit,indent=2,allow_nan=False)+'\n').encode(),
               'quarterly-report.txt':report(audit).encode()}
    manifest={'schema':'amalgam.airline-quarterly-integrity.v1',
              'files':{name:hashlib.sha256(data).hexdigest() for name,data in {**contents,**generated}.items()}}
    if args.verify:
        for name,data in generated.items():
            if (root/name).read_bytes()!=data:raise ValueError('reproduction mismatch: '+name)
        if _parse_json((root/'quarterly-manifest.json').read_bytes())!=manifest:raise ValueError('manifest mismatch')
        print('Retained SEC responses, normalized data, issuer comparisons and reports reproduce.')
    else:
        for name,data in generated.items():(root/name).write_bytes(data)
        (root/'quarterly-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('Direct quarters:',audit['direct_quarters'],'| issuer matches:',audit['issuer_matches'],'| trading eligible: 0')


if __name__=='__main__':main()
