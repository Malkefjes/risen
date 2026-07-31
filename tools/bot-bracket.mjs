// How much does playing well change each class's run?
//
// TWO BOTS, a floor and a ceiling, and one difference that matters between
// them. DUMB mashes buttons at random and throws its points anywhere. SMART
// presses everything on cooldown, spreads its points evenly, and holds
// whatever answers a telegraph — a stun, a Provoke, a brace — spending it on
// the telegraph and never on anything else.
//
// So the spread between the columns is close to a single question: what is
// reading the windup worth, in waves? That is the only skill difference in the
// pair. Everything else about them is identical or random.
//
//   dumb high, smart high   winnable on autopilot
//   dumb low,  smart high   answering the telegraph is worth a lot
//   dumb low,  smart low    hard either way
//   dumb ≈ smart            answering the telegraph changes little here
//
// Whether any of those is GOOD depends on what the game is for, which is not
// something this file gets to know — it prints columns, never a verdict.
//
// The bots live in js/sim.js (BOTS) next to simulateRun, so what runs here is
// the real game with a different hand on the controls. Standing caveat: a class
// a bot cannot pilot is not necessarily one a person cannot.
//
// win% is winning the GAME — all 30 waves, both acts, the win screen.
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
  for (const cls of ['bio', 'psy', 'sym', 'base']) {
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

// NO VERDICT COLUMN. This printed one for a long time — TOO EASY, TOO HARD,
// "skill-expressive, the target" — off thresholds nobody chose (60%, 25%, a
// 25-point spread). Three problems with that, and the third is the real one:
// the numbers were invented; "the target" made one shape of game the correct
// one; and a machine that hands you a conclusion is competing with the person
// whose job the conclusion is. The spread is still the point, it is just read
// rather than announced. What the columns mean, if the shape is unfamiliar:
//
//   dumb high, skilled high   winnable on autopilot
//   dumb low,  skilled high   playing well is worth a lot
//   dumb low,  skilled low    hard for everyone
//   dumb ~ skilled            playing well changes little
//
// Whether any of those is GOOD depends on what the game is for, which is not
// something this file gets to know.
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
