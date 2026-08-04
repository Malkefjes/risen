import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 20);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const CLS = Object.keys(CLASSES);
  const BANDS = [[1, 20], [21, 40], [41, 60], [61, 999]];
  const bandOf = w => BANDS.findIndex(b => w >= b[0] && w <= b[1]);

  const res = {};
  for (const cls of CLS) {
    const rec = [0, 0, 0, 0], fit = [0, 0, 0, 0], left = [0, 0, 0, 0];
    let uniques = 0, lastFit = [], lives = 0;
    for (let n = 0; n < RUNS; n++) {
      const r = simulateRun(cls, Object.assign({ keepLog: true }, BOTS.smart));
      lives++;
      let wave = 1, last = 0;
      for (const l of r.log) {
        const m = /^WAVE (\d+)/.exec(l);
        if (m) { wave = +m[1]; continue; }
        const b = bandOf(wave);
        if (b < 0) continue;
        if (l.startsWith('RECOVERED')) {
          rec[b]++;
          if (l.includes('UNCATALOGUED')) uniques++;
        }
        if (l.startsWith('FITTED')) { fit[b]++; last = wave; }
        if (l.startsWith('LEFT BEHIND')) left[b]++;
      }
      lastFit.push(last);
    }
    lastFit.sort((a, b) => a - b);
    res[cls] = { rec, fit, left, uniques: +(uniques / lives).toFixed(1),
                 medLastFit: lastFit[Math.floor(lastFit.length / 2)] };
  }
  return res;
}, RUNS);

console.log(`\n${RUNS} first lives per class.  Per-life averages by wave band.`
  + `\nrecovered = drop seen · fitted = equipped · left = declined\n`);
console.log('class    band      recovered  fitted  left');
for (const [cls, r] of Object.entries(out)) {
  const names = ['1-20  ', '21-40 ', '41-60 ', 'depths'];
  names.forEach((nm, i) => {
    console.log((i === 0 ? cls.padEnd(9) : ' '.repeat(9)) + nm
      + (r.rec[i] / RUNS).toFixed(1).padStart(9)
      + (r.fit[i] / RUNS).toFixed(1).padStart(8)
      + (r.left[i] / RUNS).toFixed(1).padStart(7));
  });
  console.log(' '.repeat(9) + `uncatalogued/life ${r.uniques} · median last fit at wave ${r.medLastFit}`);
}

await browser.close();
await server.close();
