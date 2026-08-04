import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 40);
const ONLY = process.argv[3] || null;
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate(({ RUNS, ONLY }) => {
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const at = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * q)]; };

  const combos = (arr, k) => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [head, ...rest] = arr;
    return combos(rest, k - 1).map(c => [head, ...c]).concat(combos(rest, k));
  };

  const SPREAD = ['str', 'instinct', 'speed', 'vit'];
  const rows = [];
  for (const cls of (ONLY ? [ONLY] : Object.keys(CLASSES))) {
    const pool = CLASSES[cls].skills.filter(s => !s.basic).map(s => s.id);
    const kits = combos(pool, Math.min(KIT_SLOTS, pool.length));
    if (kits.length < 2) continue;
    for (const kit of kits) {
      const waves = [];
      let wins = 0;
      for (let n = 0; n < RUNS; n++) {
        let i = 0;
        const r = simulateRun(cls, Object.assign({}, BOTS.smart, {
          kit, allocate: () => SPREAD[i++ % SPREAD.length] }));
        waves.push(r.wave);
        if (r.won) wins++;
      }
      rows.push({ cls, kit,
        names: kit.map(id => CLASSES[cls].skills.find(s => s.id === id).name),
        p10: at(waves, 0.1), med: med(waves), p90: at(waves, 0.9), breaches: wins });
    }
  }
  return rows;
}, { RUNS, ONLY });

console.log(`\n${RUNS} first lives per kit, even spread, smart bot.`
  + `\nDeepest wave before the first death; breached = cleared wave 60 first life.\n`);
let cls = null;
for (const r of out.sort((a, b) => a.cls.localeCompare(b.cls) || b.med - a.med)) {
  if (r.cls !== cls) {
    cls = r.cls;
    const mine = out.filter(x => x.cls === cls);
    console.log(`${cls.toUpperCase()}  —  ${mine.length} kits`);
    console.log('  kit'.padEnd(46) + 'p10  median  p90   breached');
  }
  console.log('  ' + r.names.join(' · ').padEnd(44)
    + String(r.p10).padStart(4) + String(r.med).padStart(8)
    + String(r.p90).padStart(6) + String(r.breaches + '/' + RUNS).padStart(10));
}

for (const c of [...new Set(out.map(r => r.cls))]) {
  const mine = out.filter(r => r.cls === c);
  const m = mine.map(r => r.med);
  console.log(`\n${c.toUpperCase()}  median reach across kits: ${Math.max(...m)} deepest -> ${Math.min(...m)} shallowest`
    + `  (a narrow spread means the kit choice is cosmetic)`);
}
await browser.close(); await server.close();
