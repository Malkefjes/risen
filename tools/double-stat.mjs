// TWO STATS, SPLIT EVENLY. How far does each strain get on each PAIR?
//
// The sibling of tools/single-stat.mjs, and the more honest question of the
// two: nobody plays one stat all run. Single-stat says whether a stat can carry
// a build alone; this says which pairs actually work, which is what a player is
// really choosing between at every level.
//
// Read it against the other two tables. A pair that beats both its own halves
// is two stats that need each other; a pair that loses to one of its halves is
// a stat being diluted by a passenger. And both against `balanced` in
// single-stat, since if spreading across all four beats every pair, the whole
// allocation screen is a formality.
//
// Points alternate between the two stats, one at a time, so the split is as
// close to 50/50 as the point budget allows. Leans (2:1, 3:1) are not swept —
// that is a much bigger table, and the even split is the reading that tells you
// whether a pairing works at all.
import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 40);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

// Read off the game, never listed here — see the note in tools/autopsy.mjs.
const CLS = await page.evaluate(() => Object.keys(CLASSES));
const out = await page.evaluate(({ RUNS, CLS }) => {
  const SHORT = { str: 'STR', instinct: 'INS', speed: 'SPD', vit: 'VIT' };
  const STATS = ['str', 'instinct', 'speed', 'vit'];
  const PAIRS = [];
  for (let a = 0; a < STATS.length; a++)
    for (let b = a + 1; b < STATS.length; b++) PAIRS.push([STATS[a], STATS[b]]);

  const res = {};
  for (const pair of PAIRS) {
    const name = SHORT[pair[0]] + ' + ' + SHORT[pair[1]];
    res[name] = {};
    for (const cls of CLS) {
      let i = 0;
      const runs = [];
      for (let n = 0; n < RUNS; n++) {
        i = 0;
        // Same shape as single-stat: the allocator is the only thing that
        // varies, so the piloting is held constant across the whole table.
        runs.push(simulateRun(cls, { allocate: () => pair[i++ % 2] }));
      }
      const waves = runs.map(r => r.wave).sort((a, b) => a - b);
      res[name][cls] = { med: waves[Math.floor(waves.length / 2)],
                         wins: runs.filter(r => r.won).length };
    }
  }
  return res;
}, { RUNS, CLS });

console.log(`\n${RUNS} runs per cell.  "median wave reached / wins"\n`);
console.log('pair         ' + CLS.map(c => c.padEnd(13)).join(''));
for (const [name, byCls] of Object.entries(out))
  console.log(name.padEnd(13) + CLS.map(c => `${byCls[c].med}w  ${byCls[c].wins}/${RUNS}`.padEnd(13)).join(''));
await browser.close(); await server.close();
