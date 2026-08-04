import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 40);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

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
