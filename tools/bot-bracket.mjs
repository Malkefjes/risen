// Is a class too easy, too hard, or does it reward playing well?
//
// One bot answers none of those, because a single win rate stops discriminating
// the moment it saturates: when the greedy bot won 40/40 on three classes and
// no enemy tuning could move it, that number had stopped measuring the game.
// Three bots bracket it instead — a floor that mashes, the frozen greedy
// baseline, and a ceiling that plays the obvious habits. The SPREAD is the
// reading:
//
//   dumb high, skilled high   too easy — winnable on autopilot
//   dumb low,  skilled high   skill-expressive, the target
//   dumb low,  skilled low    too hard
//   dumb ≈ skilled            no skill expression — the class plays itself,
//                             which is the case one bot cannot see
//
// The bots live in js/sim.js (BOTS) next to simulateRun, so what runs here is
// the real game with a different hand on the controls. Read the columns
// comparatively and remember the standing caveat: a class a bot cannot pilot is
// not necessarily one a person cannot.
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
    res[cls] = {};
    for (const bot of ['dumb', 'greedy', 'skilled']) {
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

// The reading is printed, not left to the eye: the gap between floor and
// ceiling is the whole product of this tool, so it says what it thinks.
function verdict(d, s) {
  if (d >= 60 && s >= 60) return 'TOO EASY — wins on autopilot';
  if (s <= 25) return 'TOO HARD — even played well';
  if (s - d >= 25) return 'skill-expressive';
  if (Math.abs(s - d) < 15) return 'FLAT — playing well changes little';
  return 'ok';
}

console.log(`\n${RUNS} runs per cell.  win% (median wave reached)\n`);
console.log('class   dumb          greedy        skilled       reading');
for (const [cls, row] of Object.entries(out)) {
  const cell = b => `${row[b].win}% (w${row[b].medWave})`.padEnd(14);
  console.log(cls.padEnd(8) + cell('dumb') + cell('greedy') + cell('skilled')
    + verdict(row.dumb.win, row.skilled.win));
}
console.log('\nmedian turns to win (skilled), lower is a faster kill:');
for (const [cls, row] of Object.entries(out))
  console.log('  ' + cls.padEnd(6), row.skilled.medTurns ?? '— never won');

await browser.close();
await server.close();
