// WHAT IS THE STATE OF THE GAME? Four readings that a single win rate cannot
// give you, and one structural choice that makes them mean anything.
//
// The bracket asks how much PILOTING is worth. This asks the rest:
//
//   1. WHERE runs end, as p10 / median / p90. The spread is the reading, not
//      the middle: a narrow band is a WALL (everyone dies in the same two
//      waves), a wide one is a game that responds to what happens. Two classes
//      can share a median and be nothing alike.
//   2. WHAT killed them — attrition (ordinary hits) against telegraphs. This is
//      what points at a lever. Same median wave, opposite fixes: dying to
//      heavies is a reading problem, dying to ordinary hits is an economy one.
//   3. WHICH SKILLS FIRE, per 100 of your turns. A button nobody presses is a
//      design that is not in the game, and this is the only instrument that
//      would notice — it is how old psy's Momentum problem surfaced, on a tool
//      that has since been deleted.
//   4. THE DANGER CURVE — how many of your own turns a fight gives you before
//      its hits add up to your bar. Hits-to-die alone lies, because you act
//      more often than it does. This is the number that showed act 2 going
//      flat while every other reading looked fine.
//
// ---- THE ALLOCATION PROBLEM, which decides whether any of it is true -------
// Every number here depends on where the points went, and double-stat showed
// the allocation swings a run further than the piloting does. So a fixed spread
// would make this a report about one mediocre build wearing the name of the
// game.
//
// It is not fixed and it is not hardcoded either. The tool SCOUTS: a cheap
// sweep finds whichever allocation currently reaches furthest for each class,
// and then autopsies two — the even spread as a control, and the scout's
// winner. Hardcoding today's best build (SPD+VIT, as it happens) would bake a
// verdict into an instrument meant to outlive it; discovering it every run
// means this file cannot go stale, and "what is currently strongest" becomes a
// finding it reports rather than an assumption it makes.
//
// Prints numbers. Concludes nothing. See tools/README.md.
import { serve, launch } from '../tests/harness.mjs';

// 60 by default: the whole thing costs about 4 seconds, so there is no reason
// to read a p10/p90 band off a thin sample. Pass a number to change it.
const RUNS = Number(process.argv[2] || 60);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const CLS = ['bio', 'psy', 'sym', 'base'];

const out = await page.evaluate(({ RUNS, CLS }) => {
  const STATS = ['str', 'instinct', 'speed', 'vit'];
  const SHORT = { str:'STR', instinct:'INS', speed:'SPD', vit:'VIT' };
  const med = a => { const b = a.slice().sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; };
  const at = (a, q) => { const b = a.slice().sort((x,y)=>x-y); return b[Math.floor(b.length*q)]; };

  // Every allocation a player could reasonably commit to: each stat alone, each
  // pair split evenly, and the spread. Cycling one at a time means the split is
  // as close to even as the point budget allows.
  const PLANS = [{ name: 'spread', stats: STATS.slice() }];
  for (const s of STATS) PLANS.push({ name: SHORT[s], stats: [s] });
  for (let a = 0; a < STATS.length; a++)
    for (let b = a+1; b < STATS.length; b++)
      PLANS.push({ name: SHORT[STATS[a]] + '+' + SHORT[STATS[b]], stats: [STATS[a], STATS[b]] });
  const allocFor = plan => { let i = 0; return () => plan.stats[i++ % plan.stats.length]; };

  // ---- Scout: which allocation currently gets furthest, per class ----------
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

  // ---- Autopsy: the control and the scout's winner -------------------------
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
        // What is landing on YOU. "HEAVY ×4 → You" is a telegraph, "SPOILED ×2"
        // is one that was answered into a stagger resist, "Attack" is ordinary.
        const m = /^([A-Z]+)(?: ×[\d.]+)? → You\s/.exec(l);
        if (m) lastHit = m[1] === 'HEAVY' || m[1] === 'SPOILED' ? 'telegraph'
                       : (m[1] === 'POISON' || m[1] === 'BLEED') ? 'ailment' : m[1];
        if (/^Attack → You\s/.test(l)) lastHit = 'ordinary hit';
        // SKILL USES, AND THERE ARE TWO LOG SHAPES. An attack or a heal writes
        // "Slash → Enemy" / "Bandage → You"; a buff or a Provoke writes
        // "Chitin  cast" / "Raise Spines  cast" with no arrow at all. Matching
        // only the arrow form reports every buff in the game as never pressed —
        // which this tool did on its first run, and which is exactly the kind
        // of confident zero an instrument should not be able to produce. Hence
        // the coverage check below.
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

  // ---- The danger curve ---------------------------------------------------
  // Strains share one stat sheet, so this is a property of the enemy table
  // against a chosen allocation, not of a class. Measured at each boss wave
  // with the sheet a run of that allocation actually arrives holding.
  const curve = [];
  for (const wave of [5, 10, 15, 20, 25, 30]) {
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

// ---- Print ---------------------------------------------------------------
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
// A ZERO HERE MUST MEAN "NOBODY PRESSED IT", never "the parser missed it". You
// act once per player turn, so matched casts should track turns closely; a big
// shortfall means the transcript grew a shape this file does not read, and
// every zero above it is suspect. Loud, because a silently wrong instrument is
// worse than no instrument.
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
