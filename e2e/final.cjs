const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lQAAAABJRU5ErkJggg==','base64');
  for (const [path, name] of [['/','f-home'],['/?route=hampi-heritage-trail','f-route'],['/?view=creators','f-studio'],['/?view=routes','f-explore']]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    await p.goto('http://127.0.0.1:4173'+path, { waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(900);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(600);
    await p.screenshot({ path: `/tmp/claude-0/-home-user-NAARAD-IO/7f205e9d-5bab-54ee-809d-3e0039d95683/scratchpad/${name}.png`, fullPage: true });
    await p.close();
  }
  await b.close(); console.log('shots done');
})();
