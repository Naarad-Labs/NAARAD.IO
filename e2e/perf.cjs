const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const [path, label] of [['/', 'home'], ['/routes/hampi-heritage-trail/', 'route']]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const bytes = { js: 0, css: 0, img: 0, font: 0, other: 0 };
    p.on('response', async (r) => {
      try {
        const len = Number(r.headers()['content-length'] || 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
        const u = r.url();
        if (/\.m?js(\?|$)/.test(u)) bytes.js += len;
        else if (/\.css(\?|$)/.test(u)) bytes.css += len;
        else if (/\.(avif|webp|png|jpg|svg)(\?|$)/.test(u)) bytes.img += len;
        else if (/\.(ttf|woff2?)(\?|$)/.test(u)) bytes.font += len;
        else bytes.other += len;
      } catch {}
    });
    await p.goto('http://127.0.0.1:4173' + path, { waitUntil: 'networkidle' });
    const vitals = await p.evaluate(() => new Promise((resolve) => {
      let lcp = 0, cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        resolve({ lcp: Math.round(lcp), cls: +cls.toFixed(4), domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) });
      }, 2500);
    }));
    const kb = (n) => (n / 1024).toFixed(1) + ' KB';
    console.log(`${label}: LCP ${vitals.lcp}ms  CLS ${vitals.cls}  DCL ${vitals.domContentLoaded}ms`);
    console.log(`   js ${kb(bytes.js)} | css ${kb(bytes.css)} | img ${kb(bytes.img)} | font ${kb(bytes.font)} | other ${kb(bytes.other)}`);
    await ctx.close();
  }
  await b.close();
})();
