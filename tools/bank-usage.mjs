// Can each strain's resource bank actually fill?
//
// The instrument that found psy: Momentum is +1 per landed hit and -2 per hit
// taken, so at the 1:1 turn anchor every exchange is net -1 and the bank
// drains. Three of psy's four skills are gated behind it, so they never fire.
import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 40);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const res = {};
  for (const cls of ['bio', 'psy', 'sym', 'base']) {
    const rows = [];
    for (let i = 0; i < RUNS; i++) {
      // The bank is sampled from the transcript rather than instrumented: every
      // change already logs "NAME +n  (held/cap)", so the log IS the record.
      const r = simulateRun(cls, { keepLog: true });
      let peak = 0, notPaid = 0;
      for (const line of r.log) {
        const m = line.match(/\((\d+)\/(\d+)\)/);
        if (m) peak = Math.max(peak, +m[1]);
        if (/not paid/.test(line)) notPaid++;
      }
      rows.push({ peak, notPaid, wave: r.wave, won: r.won, cap: r.bank ? r.bank.cap : 0,
                  name: r.bank ? r.bank.name : '—' });
    }
    res[cls] = rows;
  }
  return res;
}, RUNS);

console.log(`\n${RUNS} runs per strain.  "not paid" = a gated skill fired with too little in the bank.\n`);
console.log('strain   bank        cap   peak held   not paid   median wave   wins');
for (const [cls, rows] of Object.entries(out)) {
  const avg = k => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1);
  const waves = rows.map(r => r.wave).sort((a, b) => a - b);
  console.log(cls.padEnd(8), rows[0].name.padEnd(11), String(rows[0].cap).padStart(3),
    avg('peak').padStart(10), avg('notPaid').padStart(11),
    String(waves[Math.floor(waves.length / 2)]).padStart(13),
    `${rows.filter(r => r.won).length}/${RUNS}`.padStart(7));
}
await browser.close(); await server.close();
