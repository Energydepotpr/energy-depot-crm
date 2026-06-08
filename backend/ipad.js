const puppeteer = require('puppeteer');
(async () => {
  // 1) token admin
  const tr = await fetch('https://backend-production-c4232.up.railway.app/api/public/_audit-7m2k?k=edpr-install-2026-06-01');
  const { token, user } = await tr.json();
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const pg = await b.newPage();
  // iPhone 14 Pro Max
  await pg.setViewport({ width: 430, height: 932, isMobile: true, deviceScaleFactor: 3, hasTouch: true });
  await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  // set localStorage en el origin
  await pg.goto('https://crm-energydepotpr.com/login', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await pg.evaluate((t, u) => { localStorage.setItem('crm_token', t); localStorage.setItem('crm_user', JSON.stringify(u)); }, token, user);

  async function shot(path, file) {
    await pg.goto('https://crm-energydepotpr.com' + path, { waitUntil: 'networkidle0', timeout: 40000 });
    await new Promise(r => setTimeout(r, 2500));
    const info = await pg.evaluate(() => ({ w: document.documentElement.scrollWidth, vp: window.innerWidth, overflow: document.documentElement.scrollWidth > window.innerWidth + 3 }));
    await pg.screenshot({ path: file, fullPage: false });
    console.log(path, '→ scrollW', info.w, 'vp', info.vp, 'desborde:', info.overflow);
  }
  await shot('/contabilidad', 'ip-contab.png');
  await b.close();
})().catch(e => console.log('ERR', e.message));
