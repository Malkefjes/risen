import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 30);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const out = await page.evaluate((RUNS) => {
  const CLS = Object.keys(CLASSES);
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const at = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * q)]; };

  const res = {};
  for (const cls of CLS) {
    const waves = [], killer = {}, uses = {};
    let breaches = 0, playerTurns = 0;
    for (let n = 0; n < RUNS; n++) {
      const r = simulateRun(cls, Object.assign({ keepLog: true }, BOTS.smart));
      waves.push(r.wave);
      if (r.won) breaches++;
      playerTurns += r.turns || 0;
      let lastHit = null;
      for (const l of r.log) {
        const m = /^([A-Z]+)(?: ×[\d.]+)? → You\s/.exec(l);
        if (m) lastHit = m[1] === 'HEAVY' || m[1] === 'SPOILED' ? 'telegraph'
                       : (m[1] === 'POISON' || m[1] === 'BLEED') ? 'ailment' : m[1];
        if (/^Attack → You\s/.test(l)) lastHit = 'ordinary hit';
        for (const sk of CLASSES[cls].skills)
          if (l.startsWith(sk.name + ' →') || l.startsWith(sk.name + '  ')) {
            uses[sk.name] = (uses[sk.name] || 0) + 1; break;
          }
      }
      killer[lastHit || 'unknown'] = (killer[lastHit || 'unknown'] || 0) + 1;
    }

    const dumbWaves = [];
    for (let n = 0; n < RUNS; n++) dumbWaves.push(simulateRun(cls, BOTS.dumb).wave);

    const lifeRuns = Math.max(6, Math.round(RUNS / 3));
    const lives = [[], [], []], lifeTurns = [];
    for (let n = 0; n < lifeRuns; n++) {
      const reaches = [], turnMarks = [];
      simulateRun(cls, Object.assign({}, BOTS.smart, {
        maxDeaths: 3,
        each: s => {
          if (s.deaths > reaches.length && s.diedAt) {
            reaches.push(s.diedAt);
            turnMarks.push(s.runTurns || 0);
          }
        }
      }));
      let best = 0;
      reaches.forEach((w, i) => {
        best = Math.max(best, w);
        if (lives[i]) lives[i].push(best);
      });
      for (let i = 1; i < turnMarks.length; i++) lifeTurns.push(turnMarks[i] - turnMarks[i - 1]);
    }

    res[cls] = {
      p10: at(waves, 0.1), med: med(waves), p90: at(waves, 0.9),
      breachPct: Math.round(breaches / RUNS * 100),
      killer, playerTurns,
      dumbMed: med(dumbWaves),
      life: lives.map(a => a.length ? med(a) : null),
      turnsPerLife: lifeTurns.length ? med(lifeTurns) : null,
      uses: CLASSES[cls].skills.map(sk => ({ name: sk.name, n: uses[sk.name] || 0 }))
    };
  }
  return res;
}, RUNS);

console.log(`\n${RUNS} first lives per class (life curve at ~1/3 that).  Numbers, not verdicts.\n`);

console.log('WHERE FIRST LIVES END   — deepest wave before the first death');
console.log('class   p10  median  p90   breached');
for (const [cls, r] of Object.entries(out))
  console.log(cls.padEnd(7) + String(r.p10).padStart(4) + String(r.med).padStart(7)
    + String(r.p90).padStart(6) + ('   ' + r.breachPct + '%').padStart(9));

console.log('\nWHAT KILLS THEM');
for (const [cls, r] of Object.entries(out)) {
  const tot = Object.values(r.killer).reduce((a, b) => a + b, 0) || 1;
  const by = Object.entries(r.killer).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${Math.round(v / tot * 100)}%`).join(', ');
  console.log('  ' + cls.padEnd(6) + by);
}

console.log('\nWHAT PILOTING IS WORTH   — smart median minus dumb median, first life');
for (const [cls, r] of Object.entries(out))
  console.log('  ' + cls.padEnd(6) + `dumb ${r.dumbMed} -> smart ${r.med}  (+${r.med - r.dumbMed} waves)`);

console.log('\nWHAT ANOTHER LIFE BUYS   — median deepest wave after life 1 / 2 / 3, same character');
for (const [cls, r] of Object.entries(out))
  console.log('  ' + cls.padEnd(6) + r.life.map(v => v == null ? '—' : v).join('  ->  ')
    + (r.turnsPerLife ? `   (~${r.turnsPerLife} player turns per extra life)` : ''));

console.log('\nWHICH BUTTONS FIRE   — uses per 100 player turns; a button nobody presses is not in the game');
for (const [cls, r] of Object.entries(out)) {
  const per = n => (r.playerTurns ? (n / r.playerTurns * 100) : 0).toFixed(1);
  console.log('  ' + cls.padEnd(6) + r.uses.map(u => `${u.name} ${per(u.n)}`).join('   '));
}

await browser.close();
await server.close();
