import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 20);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const CLS = ['hyd', 'sym'];
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

  const rows = [];
  for (const id of [null].concat(Object.keys(HAZARDS))) {
    const depth = [], levels = [];
    for (const cls of CLS) {
      for (let n = 0; n < RUNS; n++) {
        const r = simulateRun(cls, Object.assign({}, BOTS.smart, {
          each: id ? (s => {
            if (s.won && (!s.hazard || s.hazard.id !== id))
              s.hazard = { id, from: BALANCE.finalWave + 1, until: 99999 };
          }) : undefined
        }));
        if (r.won) { depth.push(r.wave - BALANCE.finalWave); levels.push(r.level); }
      }
    }
    rows.push({ toll: id ? HAZARDS[id].name : 'bot picks first offer',
                xp: id ? HAZARDS[id].xpMult : null,
                n: depth.length,
                medDepth: depth.length ? med(depth) : null,
                medLevel: levels.length ? med(levels) : null });
  }
  return rows;
}, RUNS);

console.log(`\n${RUNS} lives per class (hyd, sym) per toll; only breached lives counted.`
  + `\nEach toll forced for the whole descent past wave 60.\n`);
console.log('toll                    breached   med waves past 60   med level at death   xp mult');
for (const r of out)
  console.log(r.toll.padEnd(24) + String(r.n).padStart(4)
    + String(r.medDepth == null ? '—' : r.medDepth).padStart(15)
    + String(r.medLevel == null ? '—' : r.medLevel).padStart(19)
    + (r.xp ? ('×' + r.xp.toFixed(2)).padStart(12) : '           —'));

await browser.close();
await server.close();
