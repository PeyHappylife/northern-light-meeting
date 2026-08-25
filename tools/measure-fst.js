const { chromium } = require('playwright-core');
const path = process.argv[2];
const RUNS = parseInt(process.argv[3] || '3', 10);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--force-prefers-reduced-motion=false']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + path);
  await page.waitForFunction('typeof window.__fstMeasure === "function"');
  const names = await page.evaluate('window.__fstScenes');

  const runs = [];
  for (let r = 0; r < RUNS; r++) runs.push(await page.evaluate('window.__fstMeasure()'));

  // 各シーンの中央値をとる（GC等の外れ値を避ける）
  const med = names.map((_, i) => {
    const v = runs.map(r => r[i]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });

  // 崩れ検出：どのシーンでも要素がはみ出していないか
  const overflow = await page.evaluate(`(() => {
    const bad = [];
    document.querySelectorAll('.scene').forEach((sc, i) => {
      sc.classList.add('is-live');
      sc.querySelectorAll('.beat').forEach(b => b.classList.add('on'));
      const r = sc.getBoundingClientRect();
      if (r.width > document.documentElement.clientWidth + 1) bad.push(i);
      if (i !== 0) sc.classList.remove('is-live');
    });
    return { bad, docScrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  })()`);

  console.log(JSON.stringify({ names, runs, med, overflow, errs }, null, 1));
  await browser.close();
})();
