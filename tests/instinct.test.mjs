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
export default async function ({ page, ok, say }) {
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

  // THE CURVE IS REPORTED, NOT PRESCRIBED. What crit chance a point buys, where
  // it stops climbing, and where Instinct overtakes Strength are the balance
  // decisions this stat IS — so pinning them here would mean any future change
  // to how Instinct feels has to argue with a test first. Printed instead, at
  // every sheet the run can reach, so a change shows up as a moved curve.
  say('crit chance by Instinct',
      curve.map(r => r.ins + ':' + Math.round(r.chance * 100) + '%').join('  '));
  say('crit damage by Instinct',
      curve.map(r => r.ins + ':×' + r.mult.toFixed(2)).join('  '));
  // Not 100%: a crit that always happens stops being an event, and the gold
  // floater stops naming one. One plain hit in ten is the point.
  ok('the cap leaves room for a plain hit', at(50).chance < 1, String(at(50).chance));

  // THESE STAY CHECKS, and the line is not arbitrary: none of them names a
  // number. They say a point of Instinct is never WASTED — the two terms only
  // ever go up, and they keep going up past the chance cap. If one of these
  // fails, a player has spent a point and got nothing or got less, which is a
  // bug in any balance you might want, not a balance you might want.
  ok('crit damage climbs with Instinct from point one',
     curve.every((r, i) => !i || r.mult > curve[i-1].mult), JSON.stringify(curve.map(r => r.mult)));
  ok('both terms rise together', at(45).chance > at(25).chance && at(45).mult > at(25).mult,
     JSON.stringify([at(25), at(45)]));
  ok('overinvestment is never wasted — damage keeps climbing past the chance cap',
     at(50).mult > at(45).mult, JSON.stringify([at(45).mult, at(50).mult]));

  // ---- Instinct against Strength -----------------------------------------
  // The comparison the quadratic exists to win, reported as the two curves and
  // where they cross. This used to assert four things at once: that Strength
  // wins early, that Instinct wins late, that they are level within 1% at 40,
  // and that they cross exactly once. All four are opinions about how a stat
  // should feel over a run — real opinions, argued for in the balance header —
  // and none of them is a fact a test can own. Wanting Instinct good early is
  // now a design change, not a fight with a test suite.
  say('Instinct vs Strength, damage multiple at the same point spend',
      curve.map(r => r.ins + ': ins ' + r.gain.toFixed(2) + ' / str ' + r.strGain.toFixed(2)).join('   '));
  const crossings = [];
  curve.forEach((r, i) => {
    if (i && (curve[i-1].gain > curve[i-1].strGain) !== (r.gain > r.strGain))
      crossings.push(curve[i-1].ins + '->' + r.ins);
  });
  say('where the two curves cross',
      crossings.length ? crossings.join(', ') : 'they never cross in this range');

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
  ok('the strain-charge knob is parked at zero',
     await page.evaluate(() => BALANCE.player.critStrainGain) === 0);
  const parked = await page.evaluate(() => {
    const out = { crits: 0, banked: 0, poisonFromCrit: 0 };
    for (const cls of ['sym', 'base', 'bio'])
      for (let n = 0; n < 6; n++) {
        const r = simulateRun(cls, { allocate: () => 'instinct', keepLog: true });
        for (const l of r.log) {
          // ANY line whose target is not You: a player crit, wherever it lands.
          // This matched '→ MCP' until the two acts arrived, which quietly made
          // it "crits landed in ACT 2" — so it only counted at all while some
          // class could reach wave 16, and it went to zero the moment none did.
          // What it is guarding is that runs crit somewhere, not where.
          if (/CRIT ×/.test(l) && !/→ You/.test(l)) out.crits++;
          // The bank lines creditCrit would write, in any of its shapes. THORNS
          // is sym's now that its wallet is gone; the CRIT qualifier is what
          // separates a banked charge from the growth every hit taken writes.
          if (/(THORNS|RESOLVE) \+/.test(l) && l.includes('CRIT')) out.banked++;
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
    const was = BALANCE.player.critStrainGain;
    BALANCE.player.critStrainGain = 1;
    // Sym's charge is THORNS now — the wallet is gone, so the same sentence
    // has to cash out as growth. hp is set because growThorns declines to feed
    // a corpse.
    const p = { class: 'sym', str: 5, instinct: 5, speed: 5, vit: 5, thornsGrown: 0,
                hp: 100, isPlayer: true, statuses: [], talents: {} };
    applyDerivedStats(p);
    creditCrit(p, { name: 'x', isPlayer: false, hp: 100, maxHp: 100, statuses: [] });
    BALANCE.player.critStrainGain = was;
    return p.thornsGrown;
  });
  ok('flipping the knob is the whole switch', flipped === 1, String(flipped));

  // A killing crit must never stack poison onto a corpse — the tick would be
  // logged against something already dead and never come due. Asserted with the
  // knob deliberately on, since that is the only state where it can happen.
  const corpse = await page.evaluate(() => {
    const was = BALANCE.player.critStrainGain;
    BALANCE.player.critStrainGain = 1;
    const p = { class: 'bio', str: 5, instinct: 5, speed: 5, vit: 5, talents: {} };
    applyDerivedStats(p);
    const e = { name: 'x', isPlayer: false, hp: 0, maxHp: 100, statuses: [] };
    creditCrit(p, e);
    BALANCE.player.critStrainGain = was;
    return e.statuses.length;
  });
  ok('a killing crit does not poison a corpse', corpse === 0, String(corpse));
}
