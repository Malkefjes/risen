import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 30);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const CLS = Object.keys(CLASSES);
  const BANDS = [[1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 60], [61, 999]];
  const bandOf = w => BANDS.findIndex(b => w >= b[0] && w <= b[1]);
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

  const res = {};
  for (const cls of CLS) {
    const bands = BANDS.map(() => ({ turns: 0, kills: 0, taken: 0, waves: 0,
                                     mins: [], scared: 0, visited: 0 }));
    const firstScares = [];
    for (let n = 0; n < RUNS; n++) {
      const perWave = {};
      simulateRun(cls, Object.assign({}, BOTS.smart, {
        each: s => {
          const p = state.player;
          if (!p || !p.maxHp) return;
          const w = s.wave;
          const r = perWave[w] || (perWave[w] = {
            t0: s.runTurns || 0, k0: s.kills, d0: s.damageTaken || 0, min: 1 });
          r.min = Math.min(r.min, p.hp / p.maxHp);
          r.t1 = s.runTurns || 0; r.k1 = s.kills; r.d1 = s.damageTaken || 0;
          r.maxHp = p.maxHp;
        }
      }));
      let firstScare = null;
      const runMins = BANDS.map(() => 1);
      const isBig = w => (w % 10 === 0)
        || (w <= 60 ? (w === 5 || w === 15 || w === 25) : (w - 60) % 10 === 5);
      for (const w of Object.keys(perWave).map(Number).sort((a, b) => a - b)) {
        const r = perWave[w], b = bandOf(w);
        if (b < 0) continue;
        bands[b].turns += (r.t1 - r.t0) || 0;
        bands[b].kills += (r.k1 - r.k0) || 0;
        if (!isBig(w)) {
          bands[b].trashTurns = (bands[b].trashTurns || 0) + ((r.t1 - r.t0) || 0);
          bands[b].trashKills = (bands[b].trashKills || 0) + ((r.k1 - r.k0) || 0);
        }
        bands[b].taken += r.maxHp ? ((r.d1 - r.d0) / r.maxHp) : 0;
        bands[b].waves++;
        runMins[b] = Math.min(runMins[b], r.min);
        if (firstScare == null && r.min < 0.35) firstScare = w;
      }
      BANDS.forEach((_, b) => {
        const touched = Object.keys(perWave).map(Number).some(w => bandOf(w) === b);
        if (touched) {
          bands[b].visited++;
          bands[b].mins.push(runMins[b]);
          if (runMins[b] < 0.35) bands[b].scared++;
        }
      });
      if (firstScare != null) firstScares.push(firstScare);
    }
    res[cls] = {
      bands: bands.map(b => ({
        tpk: b.kills ? +(b.turns / b.kills).toFixed(1) : null,
        tpkTrash: b.trashKills ? +((b.trashTurns || 0) / b.trashKills).toFixed(1) : null,
        takenPerWave: b.waves ? Math.round(b.taken / b.waves * 100) : null,
        medMin: b.mins.length ? Math.round(med(b.mins) * 100) : null,
        scared: b.visited ? Math.round(b.scared / b.visited * 100) : null,
        visited: b.visited
      })),
      firstScare: firstScares.length ? med(firstScares) : null,
      scaredEver: Math.round(firstScares.length / RUNS * 100)
    };
  }
  return res;
}, RUNS);

const NAMES = ['1-10 ', '11-20', '21-30', '31-40', '41-50', '51-60', '61+  '];
console.log(`\n${RUNS} first lives per class, smart bot, even spread.`
  + `\nturns/kill = player turns per enemy killed (1.0 = one-tapping); trash excludes champions and bosses`
  + `\ntaken/wave = damage taken per wave as % of max HP`
  + `\nlow HP = median lowest HP% touched in the band · scared = % of lives under 35% there\n`);

for (const [cls, r] of Object.entries(out)) {
  console.log(cls.toUpperCase()
    + `   first scare (under 35% HP): ` + (r.firstScare ? 'median wave ' + r.firstScare : 'never')
    + ` · ${r.scaredEver}% of lives ever scared`);
  console.log('  band   turns/kill  trash-only  taken/wave  low HP  scared   lives there');
  r.bands.forEach((b, i) => {
    if (!b.visited) return;
    console.log('  ' + NAMES[i]
      + String(b.tpk == null ? '—' : b.tpk).padStart(9)
      + String(b.tpkTrash == null ? '—' : b.tpkTrash).padStart(11)
      + String(b.takenPerWave == null ? '—' : b.takenPerWave + '%').padStart(11)
      + String(b.medMin == null ? '—' : b.medMin + '%').padStart(9)
      + String(b.scared == null ? '—' : b.scared + '%').padStart(8)
      + String(b.visited + '/' + RUNS).padStart(11));
  });
  console.log('');
}

await browser.close();
await server.close();
