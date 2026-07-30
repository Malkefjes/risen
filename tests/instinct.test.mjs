// INSTINCT MUST BUY SOMETHING. It once fed crit chance at 1.1% a point against
// a fixed double, which made one point worth 1.1% more damage where a Strength
// point was worth 20% — a stat you could pour a whole run into and not feel.
// Now it does two things, and this suite guards both:
//
//   the crit pair   chance climbs to the cap, and points PAST the cap climb
//                   crit damage instead. The two must never rise together, or
//                   Instinct is scaling one of its own terms by the other.
//   the bank        a crit feeds your strain — Momentum, a Spore, Resolve, or
//                   a poison stack, whichever the strain runs on.
//
// A fast suite: no clicking, no browser waits. Everything here is the real
// rules read off a real sheet through simulateRun and applyDerivedStats —
// dozens of runs in the time one on-screen fight takes to animate.
export default async function ({ page, ok }) {
  // ---- The crit pair ----------------------------------------------------
  // Read the sheet at a spread of Instinct values by allocating there and
  // asking the game what it produced. sheetAt drives the real derived-stat
  // path rather than re-implementing the formula, so a change to either lands
  // here as a failure instead of agreeing with a copy of itself.
  const curve = await page.evaluate(() => {
    const sheetAt = ins => {
      const p = { class: 'bio', str: 5, instinct: ins, speed: 5, vit: 5, talents: {} };
      applyDerivedStats(p);
      return { ins, chance: +p.critChance.toFixed(4), mult: +p.critMult.toFixed(4) };
    };
    return [5, 10, 20, 34, 35, 36, 45, 60].map(sheetAt);
  });
  const at = n => curve.find(r => r.ins === n);

  ok('a starting sheet crits 10% of the time', at(5).chance === 0.10, JSON.stringify(at(5)));
  ok('crit chance is twice Instinct as a percent',
     curve.filter(r => r.chance < 0.70).every(r => Math.abs(r.chance - r.ins * 0.02) < 1e-9),
     JSON.stringify(curve.map(r => [r.ins, r.chance])));
  ok('a point of Instinct is worth 2% chance', +(at(20).chance - at(10).chance).toFixed(4) === 0.20,
     at(10).chance + ' -> ' + at(20).chance);
  ok('chance caps at 70%', at(45).chance === 0.70 && at(60).chance === 0.70,
     JSON.stringify([at(45).chance, at(60).chance]));

  ok('crit damage is x2 while chance is still climbing',
     curve.filter(r => r.chance < 0.70).every(r => r.mult === 2), JSON.stringify(curve));
  ok('points past the cap buy crit damage instead', at(45).mult > at(36).mult && at(36).mult > at(35).mult,
     JSON.stringify([at(35).mult, at(36).mult, at(45).mult]));
  ok('the handover is exactly at the cap', at(35).mult === 2 && at(36).mult === 2.05,
     JSON.stringify([at(35), at(36)]));
  // The whole reason the overflow exists rather than the rate simply being
  // higher: chance and damage rising at once would make Instinct quadratic,
  // which is the one thing the balance header forbids of any single stat.
  ok('chance and damage never rise together',
     !curve.some((r, i) => i && r.chance > curve[i-1].chance && r.mult > curve[i-1].mult),
     JSON.stringify(curve));
  ok('overinvestment is never wasted',
     curve.every((r, i) => !i || r.chance > curve[i-1].chance || r.mult > curve[i-1].mult),
     JSON.stringify(curve));

  // A talent's flat crit chance is not Instinct, so it must not drag the
  // handover point down and quietly convert itself into crit damage.
  const flat = await page.evaluate(() => {
    const p = { class: 'bio', str: 5, instinct: 20, speed: 5, vit: 5, talents: { critFlat: 0.30 } };
    applyDerivedStats(p);
    return { chance: +p.critChance.toFixed(4), mult: p.critMult };
  });
  ok('a flat crit talent adds chance', flat.chance === 0.70, JSON.stringify(flat));
  ok('a flat crit talent does not buy crit damage', flat.mult === 2, JSON.stringify(flat));

  // ---- A crit feeds your strain ----------------------------------------
  // Driven through whole runs rather than by calling creditCrit: the claim is
  // "playing with Instinct fills your bank", and the only honest way to ask is
  // to play. Nothing is forced or stubbed, so the counts are noisy — hence a
  // dozen runs per class and comparisons rather than exact numbers.
  // MEASURED AS A RATE, PER PLAYER TURN, never as a total. The first version of
  // this counted crits per run and failed for exactly the wrong reason: an
  // all-Strength psy kills faster and lives longer, so it lands MORE crits in
  // absolute terms at 10% than an all-Instinct psy manages at 54% before dying
  // on wave 3. A count measures how long the run lasted; only a rate measures
  // the stat.
  const banked = await page.evaluate(() => {
    const runs = (cls, stat) => {
      const out = [];
      for (let n = 0; n < 12; n++)
        out.push(simulateRun(cls, { allocate: () => stat, keepLog: true }));
      return out;
    };
    // A player's own attack reads "Skill → MCP ...", the enemy's reads
    // "Attack → You", so the arrow carries the direction. Poison and thorns
    // also strike the enemy but never crit, so they cannot inflate this.
    const tally = (rs, name) => {
      let turns = 0, crits = 0, fromCrit = 0;
      for (const r of rs) for (const l of r.log) {
        if (/^T\d+ · YOU$/.test(l)) turns++;
        else if (/→ MCP/.test(l) && /CRIT ×/.test(l)) crits++;
        else if (name && l.includes(name + ' +') && l.includes('CRIT')) fromCrit++;
      }
      return { turns, crits, fromCrit, critsPerTurn: +(crits / Math.max(1, turns)).toFixed(3) };
    };
    const res = {};
    for (const [cls, name] of [['psy','MOMENTUM'], ['sym','SPORES'], ['base','RESOLVE']])
      res[cls] = { name, ins: tally(runs(cls, 'instinct'), name),
                        str: tally(runs(cls, 'str'), name) };
    // bio has no pip bank: the rot IS the bank, so a crit deepens the poison.
    // The claim is that the stacks climb past what Slash alone could put on —
    // its own +1 a swing — so a deep stack is Instinct's doing.
    const bio = runs('bio', 'instinct');
    res.bio = Object.assign(tally(bio, null), {
      deepest: bio.reduce((m, r) => Math.max(m, ...r.log
        .filter(l => l.includes('POISON') && l.includes('×'))
        .map(l => { const g = l.match(/×(\d+)/); return g ? +g[1] : 0; })), 0)
    });
    return res;
  });
  for (const cls of ['psy', 'sym', 'base']) {
    const r = banked[cls];
    ok(`a crit banks ${r.name} (${cls})`, r.ins.fromCrit > 0, JSON.stringify(r.ins));
    // At most one charge per crit: the rule is "a crit feeds your strain", not
    // "a crit feeds it repeatedly". More bank lines than crits would mean
    // creditCrit had been reached from somewhere other than the crit branch.
    ok(`never banks more often than it crits (${cls})`, r.ins.fromCrit <= r.ins.crits,
       JSON.stringify(r.ins));
  }
  // THE RATE CLAIM IS ASKED OF SYM ONLY, and that is a statement about the bot
  // rather than about Instinct. Buying the stat cannot raise your crit rate if
  // you never live to spend the points: the greedy bot takes psy to wave 3 and
  // Unmutated to wave 5, which is two or three level-ups, so their Instinct
  // never leaves the starting neighbourhood and the two columns come out a
  // couple of percent apart either way. Sym is the one strain the bot survives
  // with, so it is the one place a full run's allocation actually happens.
  // (Momentum being unmanageable by a bot is a known soft spot — see the
  // balance header — and this is it showing up in a test.)
  ok('Instinct crits far more often than Strength does',
     banked.sym.ins.critsPerTurn > banked.sym.str.critsPerTurn * 2,
     JSON.stringify({ ins: banked.sym.ins.critsPerTurn, str: banked.sym.str.critsPerTurn }));
  ok('bio crits deepen the rot', banked.bio.deepest > 4, JSON.stringify(banked.bio));

  // A killing crit must not stack poison onto a corpse — the tick would be
  // logged against something already dead and never come due.
  const corpse = await page.evaluate(() => {
    const p = { class: 'bio', str: 5, instinct: 5, speed: 5, vit: 5, talents: {} };
    applyDerivedStats(p);
    const e = { name:'x', isPlayer:false, hp: 0, maxHp: 100, statuses: [] };
    creditCrit(p, e);
    return e.statuses.length;
  });
  ok('a killing crit does not poison a corpse', corpse === 0, String(corpse));
}
