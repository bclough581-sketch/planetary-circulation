"""Real-browser checks for journal.html. Run with: python3 -m http.server 8765 &  then  python3 e2e/check_journal_ui.py"""
import json
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'
errs=[];reqs=[]
def new_page(b):
    ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True);pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('request',lambda r:reqs.append(r.url))
    return ctx,pg
with sync_playwright() as p:
    b=p.chromium.launch()
    # 1. normal flow
    ctx,pg=new_page(b);pg.goto(BASE+'journal.html')
    pg.click('#save');assert 'ticker' in pg.inner_text('#saveMsg').lower()
    pg.click('#sample');pg.click('#save');pg.reload();pg.click('#t-log');assert pg.locator('.item').count()==1
    pg.click('.item');pg.fill('#f-lesson','edited');pg.click('#save');pg.click('#t-log');assert pg.locator('.item').count()==1
    pg.click('#t-new');pg.click('#clear');pg.fill('#f-ticker','x1');pg.fill('#f-reason','<img src=x onerror="window.__xss=1">');pg.click('#save');pg.click('#t-log')
    assert pg.evaluate('window.__xss') is None
    pg.click('#t-rev');t=pg.inner_text('#review');assert '2' in t and 'personal milestone' in t and 'Closed cards missing a price' in t
    pg.click('#t-bak')
    with pg.expect_download() as d:pg.click('#exCsv')
    assert open(d.value.path(),'rb').read().count(b'\r\n')==3
    pg.click('#showBak');bk=pg.input_value('#bakText');assert 'amalgam-journal' in bk
    pg.click('#wipe');pg.click('#wipe');pg.click('#t-log');assert pg.locator('.item').count()==0
    pg.click('#t-bak');pg.fill('#bakText',bk);pg.click('#restore');assert 'Restored' in pg.inner_text('#bakMsg')
    # 1b. restore of an unknown version is refused
    pg.fill('#bakText',json.dumps({'app':'amalgam-journal','version':999,'entries':[]}));pg.click('#restore');assert 'version' in pg.inner_text('#bakMsg')
    ctx.close()
    # 2. unreadable storage is preserved, saving is paused, recovery text is shown
    ctx,pg=new_page(b);pg.goto(BASE+'journal.html')
    pg.evaluate("localStorage.setItem('amalgam.journal.v1','{not valid json')");pg.reload()
    assert pg.is_visible('#failBox') is False
    pg.click('#t-bak');assert pg.is_visible('#failBox');assert pg.input_value('#bakText')=='{not valid json'
    pg.click('#t-new');pg.fill('#f-ticker','SYNTH');pg.click('#save');assert 'paused' in pg.inner_text('#saveMsg')
    assert pg.evaluate("localStorage.getItem('amalgam.journal.v1')")=='{not valid json','original bytes untouched after Save'
    pg.click('#t-bak');pg.click('#discard');pg.click('#discard');assert not pg.is_visible('#failBox')
    pg.click('#t-new');pg.fill('#f-ticker','SYNTH');pg.click('#save');assert 'Saved' in pg.inner_text('#saveMsg')
    ctx.close()
    # 3. a refused write is reported as a failure, never as success
    ctx,pg=new_page(b);pg.goto(BASE+'journal.html');pg.click('#sample');pg.click('#save')
    pg.evaluate("(()=>{Storage.prototype.setItem=function(){throw new Error('quota')};})()")
    pg.click('#t-bak');pg.fill('#bakText',json.dumps({'app':'amalgam-journal','version':1,'entries':[{'id':'zz9','ticker':'NEW'}]}));pg.click('#restore')
    m=pg.inner_text('#bakMsg');assert 'NOT RESTORED' in m and 'Restored.' not in m,m
    pg.click('#wipe');pg.click('#wipe');assert 'NOT ERASED' in pg.inner_text('#bakMsg')
    pg.click('#t-new');pg.fill('#f-ticker','ANOTHER');pg.click('#save');assert 'NOT SAVED' in pg.inner_text('#saveMsg')
    pg.click('#t-log');assert pg.locator('.item').count()==1,'in-memory list rolled back after failed writes'
    ctx.close()
    ext=[u for u in reqs if not u.startswith(BASE)]
    print('external requests:',ext,'| page errors:',errs);assert not ext and not errs
    print('ALL JOURNAL UI PASS')
