// ONE STAT, ALL RUN. How far does each strain get pouring every point into a
// single stat?
//
// Answers "is this stat a build or a garnish" — the question that drove the
// Speed rework. An all-SPEED column dying where all-VIT wins means Speed is not
// competing; the two landing close means it is. The `balanced` row (every point
// spread across all four) is the control: a stat that cannot beat it alone is
// not a build, and a spread that loses to every specialist says something too.
//
// Its sibling is tools/double-stat.mjs, which asks the same question of PAIRS —
// which is where most real builds live, since nobody plays one stat.
import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 40);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const PLANS = { 'all STR': ['str'], 'all INS': ['instinct'], 'all SPD': ['speed'],
                  'all VIT': ['vit'], 'balanced': ['str', 'instinct', 'speed', 'vit'] };
  const res = {};
  for (const [name, plan] of Object.entries(PLANS)) {
    res[name] = {};
    for (const cls of ['bio', 'psy', 'sym', 'base']) {
      let i = 0;
      const runs = [];
      for (let n = 0; n < RUNS; n++) {
        i = 0;
        runs.push(simulateRun(cls, { allocate: () => plan[i++ % plan.length] }));
      }
      const waves = runs.map(r => r.wave).sort((a, b) => a - b);
      res[name][cls] = { med: waves[Math.floor(waves.length / 2)],
                         wins: runs.filter(r => r.won).length };
    }
  }
  return res;
}, RUNS);

console.log(`\n${RUNS} runs per cell.  "median wave reached / wins"\n`);
const CLS = ['bio', 'psy', 'sym', 'base'];
console.log('allocation   ' + CLS.map(c => c.padEnd(13)).join(''));
for (const [name, byCls] of Object.entries(out))
  console.log(name.padEnd(13) + CLS.map(c => `${byCls[c].med}w  ${byCls[c].wins}/${RUNS}`.padEnd(13)).join(''));
await browser.close(); await server.close();
