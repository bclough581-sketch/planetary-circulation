import json,random,datetime
from playwright.sync_api import sync_playwright
def series(seed,n=200,trend=0.0):
    random.seed(seed);c=100;out=[];d=datetime.date(2026,11,2)-datetime.timedelta(days=n+60)
    days=[]
    while len(days)<n:
        d+=datetime.timedelta(days=1)
        if d.weekday()<5:days.append(d)
    for i,dt in enumerate(days):
        c*=1+random.uniform(-.02,.02)+trend
        out.append({"datetime":dt.isoformat(),"open":str(c),"high":str(c*1.01),"low":str(c*.99),"close":str(c),"volume":str(1000+random.random()*200)})
    out.reverse();return {"status":"ok","values":out}
def handle(route):
    u=route.request.url
    sym=u.split('symbol=')[1].split('&')[0]
    if sym=='BAD':return route.fulfill(json={"status":"error","message":"symbol not found"})
    route.fulfill(json=series(sum(map(ord,sym))),headers={"access-control-allow-origin":"*"})
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':390,'height':844})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.route('**/api.twelvedata.com/**',handle)
    pg.goto('http://localhost:8765/index.html');pg.wait_for_timeout(1800)
    assert pg.is_visible('#checkview'),'check view visible'
    assert not pg.is_visible('#mapview'),'map hidden'
    pg.fill('#ckki','demo');pg.click('#ckkf button')
    pg.fill('#ckq','AAPL');pg.click('#ckf button',timeout=3000)
    pg.wait_for_selector('.ck-g',timeout=15000)
    print('gates',pg.locator('.ck-g').count(), pg.inner_text('.ck-line'))
    pg.click('.ck-g[data-i="2"]');print('drill:',pg.inner_text('#ckd2')[:200])
    pg.screenshot(path='/tmp/ck1.png',full_page=False)
    pg.click('#ckadd')
    pg.fill('#ckwi','MSFT');pg.click('#ckwf button');pg.fill('#ckwi','BAD');pg.click('#ckwf button')
    pg.fill('#ckbi','NVDA');pg.click('#ckbf button')
    pg.click('#ckscan');pg.wait_for_function("document.getElementById('ckscanst').textContent==='Done.'",timeout=90000)
    print('daily:',pg.inner_text('#ckdaily')[:300])
    pg.click('#tabs button[data-v=map]');pg.wait_for_timeout(1200)
    print('map visible',pg.is_visible('#mapview'),'canvas',pg.evaluate("[c.width,c.height]" if False else "(()=>{const c=document.getElementById('c');return [c.width,c.height]})()"),'3d btn',pg.is_visible('#to3'))
    pg.screenshot(path='/tmp/ck2.png')
    print('ERRORS',errs)
    b.close()
