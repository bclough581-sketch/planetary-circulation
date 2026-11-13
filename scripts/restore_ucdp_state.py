"""Restore sealed state by artifact ID, never by latest run outcome."""
import datetime as dt
import io
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
import zipfile

NAME = 'ucdp-dark-sealed'


def select_artifact(artifacts, branch, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    candidates = []
    for a in artifacts:
        if a.get('name') != NAME or a.get('workflow_run', {}).get('head_branch') != branch:
            continue
        expires = dt.datetime.fromisoformat(a['expires_at'].replace('Z', '+00:00'))
        if not a.get('expired', True) and expires > now:
            candidates.append(a)
    return max(candidates, key=lambda a: (a['created_at'], a['id']), default=None)


def restore(repo, branch, api, download, destination):
    artifacts, page = [], 1
    while True:
        payload = api(f'repos/{repo}/actions/artifacts?name={NAME}&per_page=100&page={page}')
        rows = payload['artifacts']
        artifacts.extend(rows)
        if len(rows) < 100:
            break
        page += 1
        if page > 100:
            raise ValueError('artifact_scan_limit')
    # Verify workflow identity: artifact names alone are not provenance.
    eligible = []
    for a in artifacts:
        if a.get('name') != NAME or a.get('workflow_run', {}).get('head_branch') != branch:
            continue
        run = api(f"repos/{repo}/actions/runs/{a['workflow_run']['id']}")
        if run.get('path') == '.github/workflows/ucdp-dark-collector.yml' and run.get('head_branch') == branch:
            eligible.append(a)
    chosen = select_artifact(eligible, branch)
    if chosen is None:
        prior = api(f'repos/{repo}/actions/workflows/ucdp-dark-collector.yml/runs?branch={urllib.parse.quote(branch, safe="")}&status=completed&per_page=1')
        if eligible or prior['workflow_runs']:
            raise ValueError('state_unavailable_no_reset')
        return None  # First-ever run only; never silently reset a known chain.
    raw = download(f"repos/{repo}/actions/artifacts/{chosen['id']}/zip")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if archive.namelist() != ['ucdp-summary.sealed'] or archive.infolist()[0].file_size > 2_000_000:
            raise ValueError('invalid_state_archive')
        sealed = archive.read('ucdp-summary.sealed')
        if len(sealed) < 44:
            raise ValueError('invalid_state_archive')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(sealed)
    return chosen['id']


def main():
    repo, branch = os.environ['GH_REPO'], os.environ['GITHUB_REF_NAME']
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise ValueError('invalid_repository')
    def binary(path):
        return subprocess.run(['gh', 'api', path], check=True, capture_output=True).stdout
    artifact_id = restore(repo, branch, lambda p: json.loads(binary(p)), binary,
                          Path('dark-state/ucdp-summary.sealed'))
    print('UCDP restore=' + ('first_run' if artifact_id is None else 'artifact_selected') +
          ('' if artifact_id is None else ' artifact_id=' + str(artifact_id)))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('UCDP restore=failed_closed')
        raise SystemExit(1) from None
