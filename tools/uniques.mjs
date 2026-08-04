import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 10);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const CLS = Object.keys(CLASSES);
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

  const control = {};
  for (const cls of CLS) {
    const waves = [];
    for (let n = 0; n < RUNS; n++) waves.push(simulateRun(cls, BOTS.smart).wave);
    control[cls] = med(waves);
  }

  const rows = [];
  for (const id of Object.keys(UNIQUES)) {
    const u = UNIQUES[id];
    const row = { id, name: u.name, rule: u.ruleText };
    for (const cls of CLS) {
      const waves = [];
      for (let n = 0; n < RUNS; n++) {
        let granted = false;
        const r = simulateRun(cls, Object.assign({}, BOTS.smart, {
          each: s => {
            if (!granted && s.wave >= u.minWave && s.awaitingInput && state.player) {
              equipItem(state.player, makeUniqueItem(id, u.minWave));
              granted = true;
            }
          }
        }));
        waves.push(r.wave);
      }
      row[cls] = med(waves) - control[cls];
    }
    rows.push(row);
  }
  return { rows, control, CLS };
}, RUNS);

console.log(`\n${RUNS} lives per cell.  Delta in median first-death wave when the unique is`
  + `\ngranted at its gate wave, vs an ungranted control.  Positive = it carries.\n`);
console.log('control medians: ' + out.CLS.map(c => `${c} ${out.control[c]}`).join(' · ') + '\n');
console.log('unique                 ' + out.CLS.map(c => c.padStart(6)).join(''));
for (const r of out.rows) {
  console.log(r.name.padEnd(23)
    + out.CLS.map(c => ((r[c] >= 0 ? '+' : '') + r[c]).padStart(6)).join(''));
}
console.log('\nRules, for reading the rows:');
for (const r of out.rows) console.log('  ' + r.name.padEnd(23) + r.rule);

await browser.close();
await server.close();
