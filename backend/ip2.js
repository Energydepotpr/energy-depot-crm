const puppeteer = require('puppeteer');
(async () => {
  const tr = await fetch('https://backend-production-c4232.up.railway.app/api/public/_audit-7m2k?k=edpr-install-2026-06-01');
  const { token, user } = await tr.json();
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 430, height: 932, isMobile: true, deviceScaleFactor: 3, hasTouch: true });
  await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1');
  await pg.goto('https://crm-energydepotpr.com/login', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await pg.evaluate((t, u) => { localStorage.setItem('crm_token', t); localStorage.setItem('crm_user', JSON.stringify(u)); }, token, user);
  // Gastos operacionales tab
  await pg.goto('https://crm-energydepotpr.com/contabilidad', { waitUntil: 'networkidle0', timeout: 40000 });
  await new Promise(r => setTimeout(r, 2000));
  await pg.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Gastos operacionales/.test(x.textContent)); if(b)b.click(); });
  await new Promise(r => setTimeout(r, 1200));
  const o1 = await pg.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 3 }));
  await pg.screenshot({ path: 'ip-gastos.png' });
  console.log('gastos desborde:', o1.overflow);
  // Facturas
  await pg.goto('https://crm-energydepotpr.com/facturas', { waitUntil: 'networkidle0', timeout: 40000 });
  await new Promise(r => setTimeout(r, 2000));
  const o2 = await pg.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 3 }));
  await pg.screenshot({ path: 'ip-facturas.png' });
  console.log('facturas desborde:', o2.overflow);
  await b.close();
})().catch(e => console.log('ERR', e.message));
