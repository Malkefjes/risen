import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 24);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const CLS = Object.keys(CLASSES);
  const STATS = ['str', 'instinct', 'speed', 'vit'];
  const SHORT = { str: 'STR', instinct: 'INS', speed: 'SPD', vit: 'VIT' };
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const at = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * q)]; };

  const PLANS = [{ name: 'spread', stats: STATS.slice() }];
  for (const s of STATS) PLANS.push({ name: SHORT[s], stats: [s] });
  for (let a = 0; a < STATS.length; a++)
    for (let b = a + 1; b < STATS.length; b++)
      PLANS.push({ name: SHORT[STATS[a]] + '+' + SHORT[STATS[b]], stats: [STATS[a], STATS[b]] });
  const allocFor = plan => { let i = 0; return () => plan.stats[i++ % plan.stats.length]; };

  const rows = [];
  for (const plan of PLANS) {
    const row = { plan: plan.name };
    for (const cls of CLS) {
      const waves = [];
      for (let n = 0; n < RUNS; n++)
        waves.push(simulateRun(cls, Object.assign({}, BOTS.smart, { allocate: allocFor(plan) })).wave);
      row[cls] = { med: med(waves), p90: at(waves, 0.9) };
    }
    rows.push(row);
  }
  return { rows, CLS };
}, RUNS);

console.log(`\n${RUNS} first lives per cell.  "median / p90" deepest wave before first death.\n`);
console.log('plan       ' + out.CLS.map(c => c.padEnd(12)).join(''));
for (const row of out.rows)
  console.log(row.plan.padEnd(11)
    + out.CLS.map(c => `${row[c].med}/${row[c].p90}`.padEnd(12)).join(''));

console.log('\nSTRONGEST FOUND vs SPREAD   — what building deliberately is worth');
const spread = out.rows[0];
for (const c of out.CLS) {
  let best = spread;
  for (const row of out.rows) if (row[c].med > best[c].med) best = row;
  console.log('  ' + c.padEnd(6) + best.plan.padEnd(10)
    + `median ${spread[c].med} -> ${best[c].med}  (+${best[c].med - spread[c].med} waves)`);
}

await browser.close();
await server.close();
