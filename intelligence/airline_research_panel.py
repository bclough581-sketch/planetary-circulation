"""Reproduce the descriptive airline panel from retained source inputs."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from .jet_fuel_history import months, SOURCE, SERIES
from .verify_research_artifact import _parse_json

CORPORATE = Path(__file__).parent / 'data' / 'delta-quarterly-curated.json'
BLOCKERS = [
    'Historical availability is not independently verified; zero rows granted trading eligibility.',
    'Six curated quarters from one selected company; Q4 and broader sector coverage missing.',
    'Regional monthly spot prices differ from realized company fuel prices and consumption.',
    'Exploratory outcomes already inspected; no registered hypothesis, controls or untouched holdout.',
    'No market returns, valuation or transaction-cost evaluation.'
]


def build(fuel, corporate):
    if (fuel.get('schema') != 'amalgam.jet-fuel-history.v1' or fuel.get('series') != SERIES
        or fuel.get('source_url') != SOURCE or fuel.get('unit') != 'USD_per_gallon'
        or fuel.get('frequency') != 'monthly' or fuel.get('publication_time_verified') is not False
        or fuel.get('predictive_advantage') != 'not_established'):
        raise ValueError('unsupported fuel source or claims')
    # Curated outcomes are pinned to the reviewed repository evidence, not arbitrary uploads.
    canonical = _parse_json(CORPORATE.read_bytes())
    if corporate != canonical:
        raise ValueError('corporate evidence differs from reviewed canonical data')
    expected = months(fuel['requested_start'], fuel['requested_end'])
    if len(expected) > 1200:
        raise ValueError('excessive date range')
    prices = {}
    previous = ''
    for row in fuel['observations']:
        period, value = row['period'], row['value']
        if (period not in expected or period <= previous or isinstance(value, bool)
            or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0):
            raise ValueError('invalid, duplicate or unordered fuel observation')
        prices[period] = value
        previous = period
    if not prices or fuel['missing_months'] != [p for p in expected if p not in prices]:
        raise ValueError('fuel coverage mismatch')
    outcomes = {r['period']: r for r in corporate['observations']}
    rows = []
    for period, outcome in sorted(outcomes.items()):
        year, q = int(period[:4]), int(period[-1])
        required = [f'{year}-{(q-1)*3+i:02d}' for i in (1, 2, 3)]
        missing = [m for m in required if m not in prices]
        next_period = f'{year+1}Q1' if q == 4 else f'{year}Q{q+1}'
        next_row = outcomes.get(next_period)
        reasons = (['missing_fuel_months'] if missing else []) + ([] if next_row else ['missing_next_quarter_outcome'])
        rows.append({'period': period, 'symbol': corporate['symbol'], 'fuel_months': required,
                     'missing_fuel_months': missing,
                     'mean_spot_usd_per_gallon': None if missing else sum(prices[m] for m in required)/3,
                     'operating_margin_percent': 100*outcome['operatingIncome']/outcome['revenue'],
                     'next_period': next_period,
                     'next_margin_percent': None if next_row is None else 100*next_row['operatingIncome']/next_row['revenue'],
                     'corporate_source_url': corporate['sources'][outcome['source']],
                     'pair_complete': not reasons, 'pair_exclusions': reasons,
                     'trading_eligible': False})
    return {'schema': 'amalgam.airline-research-panel.v1', 'rows': rows,
            'complete_lagged_pairs': sum(r['pair_complete'] for r in rows),
            'trading_eligible_rows': 0, 'predictive_advantage': 'not_established',
            'evaluation_status': 'blocked', 'blocking_reasons': BLOCKERS,
            'fuel_aggregation': 'equal_weight_mean_of_three_monthly_spot_benchmarks',
            'fuel_source_url': SOURCE, 'fuel_retrieved_utc_claim': fuel['retrieved_utc'],
            'fuel_source_exclusions': fuel['excluded'], 'corporate_input_mode': corporate['input_mode']}


def report(panel):
    lines = ['AMALGAM AIRLINE RESEARCH — DESCRIPTIVE ONLY',
             f"Complete fuel-quarter / next-quarter pairs: {panel['complete_lagged_pairs']}",
             'Trading-eligible rows: 0 | Predictive advantage: not established',
             'Quarterly fuel values: equal-weight means of three monthly spot prices; no filling.',
             'Period | Fuel mean USD/gallon | Next period | Next margin % | Pair exclusions']
    for row in panel['rows']:
        lines.append(f"{row['period']} | {row['mean_spot_usd_per_gallon']} | {row['next_period']} | {row['next_margin_percent']} | {', '.join(row['pair_exclusions']) or 'none (descriptive pair only)'}")
    lines.extend(['', 'EVALUATION BLOCKERS'] + panel['blocking_reasons'])
    lines.extend(['', 'SOURCE REFERENCES', panel['fuel_source_url']])
    lines.extend(sorted({r['corporate_source_url'] for r in panel['rows']}))
    lines.append('Internal reproducibility and checksums do not authenticate upstream facts or historical availability.')
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    root = args.directory
    fuel_bytes = (root/'jet-fuel-history.json').read_bytes()
    corporate_bytes = (root/'delta-quarterly-curated.json').read_bytes()
    if max(len(fuel_bytes), len(corporate_bytes)) > 2_000_000:
        raise ValueError('input too large')
    panel = build(_parse_json(fuel_bytes), _parse_json(corporate_bytes))
    generated = {'airline-research-panel.json': (json.dumps(panel, indent=2, allow_nan=False)+'\n').encode(),
                 'airline-research-report.txt': report(panel).encode()}
    contents = {'jet-fuel-history.json': fuel_bytes, 'delta-quarterly-curated.json': corporate_bytes, **generated}
    manifest = {'schema': 'amalgam.airline-research-integrity.v1',
                'files': {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}}
    if args.verify:
        for name, data in generated.items():
            if (root/name).read_bytes() != data:
                raise ValueError('reproduction mismatch: '+name)
        if _parse_json((root/'airline-research-manifest.json').read_bytes()) != manifest:
            raise ValueError('manifest mismatch')
        print('Downloaded inputs, panel, report and checksums reconcile.')
    else:
        for name, data in generated.items():
            (root/name).write_bytes(data)
        (root/'airline-research-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print('Complete descriptive pairs:', panel['complete_lagged_pairs'], '| trading eligible: 0 | evaluation blocked')


if __name__ == '__main__':
    main()
