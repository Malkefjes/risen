import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 40);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const FINAL = await page.evaluate(() => BALANCE.finalWave);
const out = await page.evaluate((RUNS) => {
  const res = {};
  for (const cls of Object.keys(CLASSES)) {
    res[cls] = {};
    for (const bot of ['dumb', 'smart']) {
      let wins = 0;
      const waves = [], turns = [];
      for (let n = 0; n < RUNS; n++) {
        const r = simulateRun(cls, BOTS[bot]);
        if (r.won) { wins++; turns.push(r.turns); }
        waves.push(r.wave);
      }
      waves.sort((a, b) => a - b);
      turns.sort((a, b) => a - b);
      res[cls][bot] = { win: Math.round(wins / RUNS * 100),
                        medWave: waves[Math.floor(waves.length / 2)],
                        medTurns: turns.length ? turns[Math.floor(turns.length / 2)] : null };
    }
  }
  return res;
}, RUNS);

console.log(`\n${RUNS} runs per cell.  win% = cleared all ${FINAL} waves.  (median wave reached)\n`);
console.log('class   dumb          smart         spread (smart - dumb)');
for (const [cls, row] of Object.entries(out)) {
  const cell = b => `${row[b].win}% (w${row[b].medWave})`.padEnd(14);
  const spread = row.smart.win - row.dumb.win;
  const waveSpread = row.smart.medWave - row.dumb.medWave;
  console.log(cls.padEnd(8) + cell('dumb') + cell('smart')
    + `${spread >= 0 ? '+' : ''}${spread}% win, ${waveSpread >= 0 ? '+' : ''}${waveSpread} waves`);
}
console.log('\nmedian turns to win (smart), lower is a faster kill:');
for (const [cls, row] of Object.entries(out))
  console.log('  ' + cls.padEnd(6), row.smart.medTurns ?? '— never won');

await browser.close();
await server.close();
