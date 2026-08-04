// EVERY KIT A STRAIN CAN FIT, and how far each one gets.
//
// The question this asks is NOT "which bar is best" — that is the same question
// double-stat asks about allocations, and answering it is how a game ends up
// with one build. It asks HOW MANY BARS ARE VIABLE, because that is the number
// an ARPG actually lives on: three kits that each win 40% of runs is a healthier
// game than one that wins 70% while the rest die in zone 2, and a tool that
// only reports the winner would rate the second one higher.
//
// So the reading is the SPREAD and the COUNT, not the top row. A table where
// every kit lands within a few waves of the others is a pool where the choice
// is cosmetic; one where half the pool never leaves zone 2 is a pool with
// filler in it. Both are findings. Neither is a verdict.
//
// Prints numbers. Concludes nothing. See tools/README.md.
import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 40);
const ONLY = process.argv[3] || null;      // a strain id, or every strain with a choice
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate(({ RUNS, ONLY }) => {
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const at = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * q)]; };

  // Every legal bar, in pool order so the table is stable between runs.
  const combos = (arr, k) => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [head, ...rest] = arr;
    return combos(rest, k - 1).map(c => [head, ...c]).concat(combos(rest, k));
  };

  // The allocation is held at the even spread on purpose: this table is about
  // the BAR, and letting the stats vary too would blend two questions into one
  // number that answers neither.
  const SPREAD = ['str', 'instinct', 'speed', 'vit'];
  const rows = [];
  for (const cls of (ONLY ? [ONLY] : Object.keys(CLASSES))) {
    const pool = CLASSES[cls].skills.filter(s => !s.basic).map(s => s.id);
    const kits = combos(pool, Math.min(KIT_SLOTS, pool.length));
    if (kits.length < 2) continue;          // no choice to report
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
        p10: at(waves, 0.1), med: med(waves), p90: at(waves, 0.9), wins });
    }
  }
  return rows;
}, { RUNS, ONLY });

console.log(`\n${RUNS} runs per kit, even spread, smart bot.  Every number is measured.\n`);
let cls = null;
for (const r of out.sort((a, b) => a.cls.localeCompare(b.cls) || b.wins - a.wins)) {
  if (r.cls !== cls) {
    cls = r.cls;
    const mine = out.filter(x => x.cls === cls);
    console.log(`${cls.toUpperCase()}  —  ${mine.length} kits`);
    console.log('  kit'.padEnd(46) + 'p10  median  p90   wins');
  }
  console.log('  ' + r.names.join(' · ').padEnd(44)
    + String(r.p10).padStart(4) + String(r.med).padStart(8)
    + String(r.p90).padStart(6) + String(r.wins + '/' + RUNS).padStart(8));
}
// THE SPREAD IS THE READING. Printed per strain rather than left to the eye,
// because "how far apart is best from worst" is the whole question and reading
// it off a sorted column invites reading only the top row.
for (const c of [...new Set(out.map(r => r.cls))]) {
  const mine = out.filter(r => r.cls === c);
  const w = mine.map(r => r.wins), m = mine.map(r => r.med);
  console.log(`\n${c.toUpperCase()}  best-to-worst: wins ${Math.max(...w)} -> ${Math.min(...w)}`
    + ` · median wave ${Math.max(...m)} -> ${Math.min(...m)}`);
}
await browser.close(); await server.close();
