// INSTINCT MUST BE WORTH TAKING. It once fed crit chance at 1.1% a point
// against a fixed double, which made one point worth 1.1% more damage where a
// Strength point was worth 20% — a stat you could pour a whole run into and not
// feel. It now buys crit CHANCE and crit DAMAGE with the same points, which
// makes it the one stat that is quadratic in its own points, on purpose.
//
// What this suite guards:
//
//   the pair      both terms climb, from point one, off the stat and nothing
//                 else. A mutation's flat crit chance must not also buy damage.
//   the parity    Instinct's expected damage reaches Strength's at full
//                 investment. That is the whole justification for allowing a
//                 quadratic, so it is the assertion that must not silently rot.
//   the shape     Strength wins early, Instinct wins late, and they cross once.
//   the scaffold  a crit feeds your strain is OFF but still wired, so switching
//                 it back on is a number rather than a rebuild.
//
// A fast suite: no clicking, no browser waits. Everything here is the real rules
// read off a real sheet through applyDerivedStats and simulateRun.
export default async function ({ page, ok }) {
  // ---- The pair ----------------------------------------------------------
  // sheetAt drives the real derived-stat path rather than re-implementing the
  // formula, so a change to either lands here as a failure instead of quietly
  // agreeing with a copy of itself. `expected` is average damage per hit as a
  // multiple of a non-critting sheet — the only number that can be compared
  // against Strength, since chance and damage mean nothing apart.
  const curve = await page.evaluate(() => {
    const expectedAt = ins => {
      const p = { class: 'bio', str: 5, instinct: ins, speed: 5, vit: 5, talents: {} };
      applyDerivedStats(p);
      return p;
    };
    // A STRENGTH BUILD CRITS TOO — it keeps the starting 5 Instinct, so it is
    // already swinging at x1.125 expected before it spends a point. Comparing
    // Instinct's raw expected damage against Strength's would double-count that
    // and hand Instinct a lead it has not bought. Both columns are gain over the
    // SAME starting sheet, which is the only comparison a player could feel.
    const base = (p => 1 + p.critChance * (p.critMult - 1))(expectedAt(5));
    const sheetAt = ins => {
      const p = expectedAt(ins);
      return { ins, chance: +p.critChance.toFixed(4), mult: +p.critMult.toFixed(4),
               gain: +((1 + p.critChance * (p.critMult - 1)) / base).toFixed(4),
               // A stat is (5 + points) / 5 times its starting value, so all-in
               // Strength at the same point total is simply ins/5.
               strGain: +(ins / 5).toFixed(4) };
    };
    return [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(sheetAt);
  });
  const at = n => curve.find(r => r.ins === n);

  ok('a starting sheet still crits 10% of the time', at(5).chance === 0.10, JSON.stringify(at(5)));
  ok('crit chance is twice Instinct as a percent',
     curve.filter(r => r.chance < 0.90).every(r => Math.abs(r.chance - r.ins * 0.02) < 1e-9),
     JSON.stringify(curve.map(r => [r.ins, r.chance])));
  ok('crit chance caps at 90%', at(45).chance === 0.90 && at(50).chance === 0.90,
     JSON.stringify([at(45).chance, at(50).chance]));
  // Not 100%: a crit that always happens stops being an event, and the gold
  // floater stops naming one. One plain hit in ten is the point.
  ok('the cap leaves room for a plain hit', at(50).chance < 1, String(at(50).chance));

  ok('crit damage climbs with Instinct from point one',
     curve.every((r, i) => !i || r.mult > curve[i-1].mult), JSON.stringify(curve.map(r => r.mult)));
  ok('a point of Instinct is worth 25% crit damage',
     Math.abs((at(20).mult - at(10).mult) - 2.5) < 1e-9, at(10).mult + ' -> ' + at(20).mult);
  ok('both terms rise together', at(45).chance > at(25).chance && at(45).mult > at(25).mult,
     JSON.stringify([at(25), at(45)]));
  ok('overinvestment is never wasted — damage keeps climbing past the chance cap',
     at(50).mult > at(45).mult, JSON.stringify([at(45).mult, at(50).mult]));

  // ---- The parity --------------------------------------------------------
  // The reason a quadratic is allowed at all. If this drifts, Instinct is
  // either a trap again or the only stat worth taking, and either way the
  // argument written into the balance header has stopped being true.
  // Within 30% at the top of a run's budget. A window rather than an equality
  // because the exact endpoint depends on how many levels a run reaches, which
  // is a balance number that moves; what must not drift is the two being in the
  // same league there, since that is the entire argument for the quadratic.
  ok('Instinct reaches Strength at full investment',
     Math.abs(at(45).gain - at(45).strGain) / at(45).strGain < 0.30,
     JSON.stringify({ ins: at(45).gain, str: at(45).strGain }));
  ok('they are dead level at 40 Instinct', Math.abs(at(40).gain - at(40).strGain) < 0.01,
     JSON.stringify({ ins: at(40).gain, str: at(40).strGain }));
  ok('Strength is the better buy early',
     at(15).gain < at(15).strGain && at(25).gain < at(25).strGain,
     JSON.stringify(curve.map(r => [r.ins, r.gain, r.strGain])));
  ok('Instinct is the better buy at the end', at(45).gain > at(45).strGain,
     JSON.stringify({ ins: at(45).gain, str: at(45).strGain }));
  // A square and a line cross exactly once. A second crossing would mean one of
  // the two had stopped being the shape the header claims it is — and it is also
  // how the double-counted version of this comparison announced itself, by
  // showing Instinct ahead at the anchor before it had bought anything.
  const crossings = curve.reduce((n, r, i) =>
    !i ? 0 : n + ((curve[i-1].gain > curve[i-1].strGain) !== (r.gain > r.strGain) ? 1 : 0), 0);
  ok('the two curves cross exactly once', crossings === 1, String(crossings));

  // A mutation's flat crit chance is not Instinct, so it must not also pay out
  // as crit damage — one pick quietly buying two things is the thing the
  // mutation rules exist to prevent.
  const flat = await page.evaluate(() => {
    const plain = { class: 'bio', str: 5, instinct: 20, speed: 5, vit: 5, talents: {} };
    const buffed = { class: 'bio', str: 5, instinct: 20, speed: 5, vit: 5, talents: { critFlat: 0.30 } };
    applyDerivedStats(plain); applyDerivedStats(buffed);
    return { plainChance: +plain.critChance.toFixed(4), chance: +buffed.critChance.toFixed(4),
             plainMult: plain.critMult, mult: buffed.critMult };
  });
  ok('a flat crit talent adds chance', flat.chance > flat.plainChance, JSON.stringify(flat));
  ok('a flat crit talent does not buy crit damage', flat.mult === flat.plainMult, JSON.stringify(flat));

  // ---- The scaffold ------------------------------------------------------
  // "A crit feeds your strain" is LIVE for psy (its crits plant DREAD, as the
  // kit) and parked for the other three, and the guard is that it is off for
  // them IN PLAY rather than merely set to zero: creditCrit is still reached
  // on every crit, so a stray default or a second caller would show up as a
  // bank line in a real run. Psy is deliberately absent from this loop — its
  // crit rule is supposed to fire.
  ok('the bank knob is parked at zero',
     await page.evaluate(() => BALANCE.player.critBankGain) === 0);
  const parked = await page.evaluate(() => {
    const out = { crits: 0, banked: 0, poisonFromCrit: 0 };
    for (const cls of ['sym', 'base', 'bio'])
      for (let n = 0; n < 6; n++) {
        const r = simulateRun(cls, { allocate: () => 'instinct', keepLog: true });
        for (const l of r.log) {
          if (/→ MCP/.test(l) && /CRIT ×/.test(l)) out.crits++;
          // The bank lines creditCrit would write, in either of its two shapes.
          if (/(SPORES|RESOLVE) \+/.test(l) && l.includes('CRIT')) out.banked++;
          if (/^\+ POISON/.test(l) && l.includes('CRIT')) out.poisonFromCrit++;
        }
      }
    return out;
  });
  ok('runs really do crit, so the check above means something', parked.crits > 20,
     JSON.stringify(parked));
  ok('no crit banks a charge while it is parked', parked.banked === 0, JSON.stringify(parked));
  ok('no crit deepens the rot while it is parked', parked.poisonFromCrit === 0, JSON.stringify(parked));
  // Still wired, not deleted: flipping the knob must be the whole switch.
  ok('the scaffold is still callable', await page.evaluate(() => typeof creditCrit === 'function'));
  const flipped = await page.evaluate(() => {
    const was = BALANCE.player.critBankGain;
    BALANCE.player.critBankGain = 1;
    const p = { class: 'sym', str: 5, instinct: 5, speed: 5, vit: 5, spores: 0,
                isPlayer: true, statuses: [], talents: {} };
    applyDerivedStats(p);
    creditCrit(p, { name: 'x', isPlayer: false, hp: 100, maxHp: 100, statuses: [] });
    BALANCE.player.critBankGain = was;
    return p.spores;
  });
  ok('flipping the knob is the whole switch', flipped === 1, String(flipped));

  // A killing crit must never stack poison onto a corpse — the tick would be
  // logged against something already dead and never come due. Asserted with the
  // knob deliberately on, since that is the only state where it can happen.
  const corpse = await page.evaluate(() => {
    const was = BALANCE.player.critBankGain;
    BALANCE.player.critBankGain = 1;
    const p = { class: 'bio', str: 5, instinct: 5, speed: 5, vit: 5, talents: {} };
    applyDerivedStats(p);
    const e = { name: 'x', isPlayer: false, hp: 0, maxHp: 100, statuses: [] };
    creditCrit(p, e);
    BALANCE.player.critBankGain = was;
    return e.statuses.length;
  });
  ok('a killing crit does not poison a corpse', corpse === 0, String(corpse));
}
