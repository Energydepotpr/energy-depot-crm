const puppeteer = require('puppeteer');
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});const pg=await b.newPage();
await pg.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2,hasTouch:true});
await pg.goto('https://crm-energydepotpr.com/contabilidad',{waitUntil:'networkidle0',timeout:40000});
await new Promise(r=>setTimeout(r,2000));
const i=await pg.evaluate(()=>({w:document.documentElement.scrollWidth,vp:window.innerWidth,overflow:document.documentElement.scrollWidth>window.innerWidth+3}));
console.log('scrollWidth:',i.w,'viewport:',i.vp,'desbordeHorizontal:',i.overflow);
await b.close();})().catch(e=>console.log('err',e.message));
