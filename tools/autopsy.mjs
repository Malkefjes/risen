import { serve, launch } from '../tests/harness.mjs';

const RUNS = Number(process.argv[2] || 60);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const CLS = await page.evaluate(() => Object.keys(CLASSES));

const out = await page.evaluate(({ RUNS, CLS }) => {
  const STATS = ['str', 'instinct', 'speed', 'vit'];
  const SHORT = { str:'STR', instinct:'INS', speed:'SPD', vit:'VIT' };
  const med = a => { const b = a.slice().sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; };
  const at = (a, q) => { const b = a.slice().sort((x,y)=>x-y); return b[Math.floor(b.length*q)]; };

  const PLANS = [{ name: 'spread', stats: STATS.slice() }];
  for (const s of STATS) PLANS.push({ name: SHORT[s], stats: [s] });
  for (let a = 0; a < STATS.length; a++)
    for (let b = a+1; b < STATS.length; b++)
      PLANS.push({ name: SHORT[STATS[a]] + '+' + SHORT[STATS[b]], stats: [STATS[a], STATS[b]] });
  const allocFor = plan => { let i = 0; return () => plan.stats[i++ % plan.stats.length]; };

  const SCOUT = Math.max(6, Math.round(RUNS / 3));
  const scouted = {};
  for (const cls of CLS) {
    let best = null;
    for (const plan of PLANS) {
      const waves = [];
      for (let n = 0; n < SCOUT; n++)
        waves.push(simulateRun(cls, Object.assign({}, BOTS.smart, { allocate: allocFor(plan) })).wave);
      const m = med(waves);
      if (!best || m > best.med) best = { plan, med: m };
    }
    scouted[cls] = best;
  }

  const runOne = (cls, plan, runs) => {
    const waves = [], killer = {}, uses = {};
    let wins = 0, playerTurns = 0;
    for (let n = 0; n < runs; n++) {
      const r = simulateRun(cls, Object.assign({ keepLog: true }, BOTS.smart,
                                               { allocate: allocFor(plan) }));
      waves.push(r.wave); if (r.won) wins++;
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
      if (!r.won) killer[lastHit || 'unknown'] = (killer[lastHit || 'unknown'] || 0) + 1;
    }
    const matched = Object.values(uses).reduce((a,b)=>a+b,0);
    return { wins, runs, p10: at(waves, 0.1), med: med(waves), p90: at(waves, 0.9),
             killer, playerTurns, matched,
             uses: CLASSES[cls].skills.map(sk => ({ name: sk.name, n: uses[sk.name] || 0 })) };
  };

  const rows = [];
  for (const cls of CLS) {
    rows.push({ cls, plan: 'spread', ...runOne(cls, PLANS[0], RUNS) });
    const best = scouted[cls].plan;
    if (best.name !== 'spread') rows.push({ cls, plan: best.name, ...runOne(cls, best, RUNS) });
  }

  const curve = [];
  const BOSS_WAVES = [];
  for (let w = BALANCE.bossEvery; w <= BALANCE.finalWave; w += BALANCE.bossEvery)
    BOSS_WAVES.push(w);
  for (const wave of BOSS_WAVES) {
    const row = { wave };
    for (const plan of [PLANS[0], { name:'invested', stats:['vit','speed'] }]) {
      const hp = [], rate = [];
      for (const cls of CLS)
        for (let n = 0; n < 4; n++) {
          const r = simulateRun(cls, Object.assign({}, BOTS.smart, {
            allocate: allocFor(plan), stopWhen: s => s.wave >= wave }));
          if (r.wave >= wave) { hp.push(r.derived.maxHp); rate.push(r.derived.rate); }
        }
      const e = makeEnemy(wave);
      row[plan.name] = hp.length
        ? +((med(hp) / e.damage) * (med(rate) / e.attackSpeed)).toFixed(1) : null;
    }
    curve.push(row);
  }
  return { rows, scouted: Object.fromEntries(CLS.map(c => [c, scouted[c].plan.name])), curve };
}, { RUNS, CLS });

console.log(`\n${RUNS} runs per row.  Every number is measured, none of it is a verdict.\n`);

console.log('WHERE RUNS END   — a narrow p10-p90 band is a wall; a wide one is a game that varies');
console.log('class  allocation   p10  median  p90   wins    killed by');
for (const r of out.rows) {
  const tot = Object.values(r.killer).reduce((a,b)=>a+b,0) || 1;
  const by = Object.entries(r.killer).sort((a,b)=>b[1]-a[1])
    .map(([k,v]) => `${k} ${Math.round(v/tot*100)}%`).join(', ') || '—';
  console.log(r.cls.padEnd(6) + r.plan.padEnd(13) + String(r.p10).padStart(3)
    + String(r.med).padStart(8) + String(r.p90).padStart(5)
    + `   ${r.wins}/${r.runs}`.padEnd(9) + by);
}

console.log('\nBUILD vs SPREAD   — what the allocation is worth, the way the bracket prices piloting');
for (const cls of CLS) {
  const s = out.rows.find(r => r.cls === cls && r.plan === 'spread');
  const b = out.rows.find(r => r.cls === cls && r.plan !== 'spread');
  console.log('  ' + cls.padEnd(6) + 'strongest found: ' + out.scouted[cls].padEnd(10)
    + (b ? `median ${s.med} -> ${b.med}  (+${b.med - s.med} waves)` : 'the spread is strongest'));
}

console.log('\nWHICH SKILLS FIRE   — uses per 100 of your turns; a button nobody presses is not in the game');
for (const r of out.rows) {
  const per = n => (r.playerTurns ? (n / r.playerTurns * 100) : 0).toFixed(1);
  console.log('  ' + (r.cls + '/' + r.plan).padEnd(20)
    + r.uses.map(u => `${u.name} ${per(u.n)}`).join('   '));
}

const thin = out.rows.filter(r => r.playerTurns && r.matched / r.playerTurns < 0.8);
if (thin.length) {
  console.log('\n  !! LOG COVERAGE LOW — these rows matched fewer casts than turns taken,');
  console.log('     so the zeros above may be a parsing failure rather than a finding:');
  for (const r of thin)
    console.log(`     ${r.cls}/${r.plan}: ${r.matched} casts matched across ${r.playerTurns} turns`
      + ` (${Math.round(r.matched / r.playerTurns * 100)}%)`);
}

console.log('\nTHE DANGER CURVE   — your own turns before a fight kills you, at each boss');
console.log('  wave   even spread   all-in on survival');
for (const c of out.curve)
  console.log('  ' + String(c.wave).padStart(4) + String(c.spread ?? '—').padStart(14)
    + String(c.invested ?? '—').padStart(21));

await browser.close();
await server.close();
