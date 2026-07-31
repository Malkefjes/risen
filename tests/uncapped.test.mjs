// EVERY STRAIN RUNS ON ONE UNCAPPED NUMBER, AND THERE ARE NO BANKS.
//
// The pipped wallet is gone. What replaced it is not a different widget but the
// absence of one: each strain's mechanic is a status with no stack ceiling,
// worn under a health bar like any other. A cap is a place where a mechanic
// stops being interesting — you finish filling it, everything after is thrown
// away, and "hold or spend" collapses into "spend now".
//
// This suite guards the ABSENCE, which is the thing nothing else would notice
// coming back. A stack ceiling is one line in a status definition, and it would
// reintroduce itself silently: the game would still run, the badge would still
// draw, and the only symptom would be a number that stops.
//
// What the caps must NOT be confused with: the EFFECTS are still bounded, and
// deliberately. An uncapped count with an unbounded slow walks an enemy toward
// never acting; an uncapped count with unbounded damage reduction is immunity.
// Uncapped number, bounded effect — asserted here as a pair, because either one
// alone is the wrong design.
export default async function ({ page, ok }) {

  // ---- The banks are gone -------------------------------------------------
  const gone = await page.evaluate(() => ({
    fns: ['bankOf', 'bankAdjust', 'bankPipsHtml'].filter(n => typeof window[n] === 'function'),
    caps: ['resolveCap', 'dreadCap', 'sporeCap', 'bleedStackCap']
            .filter(k => BALANCE.player[k] != null),
    pipNodes: document.querySelectorAll('.bank-row, .bank, .pip').length,
    // The one thing that must survive: a strain still declares its charge knob.
    knob: typeof BALANCE.player.critStrainGain
  }));
  ok('no bank functions are left', gone.fns.length === 0, JSON.stringify(gone.fns));
  ok('no stack ceilings are left in BALANCE', gone.caps.length === 0, JSON.stringify(gone.caps));
  ok('nothing draws pips any more', gone.pipNodes === 0, String(gone.pipNodes));
  ok('the strain-charge knob survived the rename', gone.knob === 'number', gone.knob);

  // No status definition may carry a stack ceiling. This is the line that would
  // put a cap back without anything else noticing.
  const ceilings = await page.evaluate(() =>
    Object.entries(STATUSES).filter(([, d]) => d.maxStacks != null).map(([id]) => id));
  ok('no status declares a maxStacks', ceilings.length === 0, JSON.stringify(ceilings));

  // ---- Resolve is a status, and it is uncapped ----------------------------
  const resolve = await page.evaluate(() => {
    startGame(true, 'base');
    const p = state.player;
    // Well past the old ceiling of 6, one at a time, the way a fight builds it.
    for (let i = 0; i < 40; i++) gainResolve(p, 1, 'test');
    const held = statusStacks(p, 'resolve');
    const def = STATUSES.resolve;
    return { held, isStatus: hasStatus(p, 'resolve'),
             rawField: p.resolve,
             persists: !!def.persists, permanent: !!def.permanent,
             readout: strainReadout(p) };
  });
  ok('RESOLVE is a status on the player', resolve.isStatus);
  ok('RESOLVE stacks far past the old cap of 6', resolve.held === 40, String(resolve.held));
  ok('nothing keeps a raw resolve field any more', resolve.rawField === undefined,
     String(resolve.rawField));
  ok('RESOLVE is permanent within a fight', resolve.permanent);
  // PER FIGHT, NOT PER RUN. Resolve accrues on almost every turn, so carried
  // across a run it would pass the reduction cap in act 1 and sit there — not a
  // break, an off switch. Sym's THORNS is the only run-permanent ramp.
  ok('RESOLVE does not survive into the next fight', resolve.persists === false);
  ok('the sidebar reports what is held', resolve.readout && resolve.readout.num === 40,
     JSON.stringify(resolve.readout));

  // The effect is bounded even though the count is not. Measured against a big
  // enemy hit on purpose: at the wave-1 damage of 12 the cap leaves 1.8, which
  // floors to 1, and the assertion would be about integer rounding rather than
  // about the cap. A large number makes the 15% survivable share visible.
  const guard = await page.evaluate(() => {
    const read = stacks => {
      startGame(true, 'base');
      const p = state.player, e = state.enemy;
      // The pool is bought with VITALITY rather than written onto maxHp by
      // hand. Taking a hit calls gainResolve, which recomputes the sheet — a
      // hand-set maxHp is thrown away mid-measurement and the reading becomes
      // "the fake bar collapsed", not "the guard held".
      p.vit = 100000; applyDerivedStats(p); p.hp = p.maxHp;
      p.evadeChance = 0; p.blockChance = 0;
      e.damage = 10000; e.critChance = 0;
      if (stacks) applyStatus(p, 'resolve', { stacks });
      const before = p.hp;
      applyEnemyDamage(e, p, 1);
      return before - p.hp;
    };
    return { none: read(0), some: read(10), absurd: read(10000) };
  });
  ok('holding RESOLVE reduces damage taken', guard.some < guard.none, JSON.stringify(guard));
  ok('an absurd pile is still not immunity', guard.absurd >= 1, JSON.stringify(guard));
  // 85% is the hard cap on the summed reduction, so ~15% always lands. Without
  // it an uncapped count would simply be invulnerability with extra steps.
  ok('the reduction is capped, so the pile cannot buy invulnerability',
     guard.absurd >= guard.none * 0.14, JSON.stringify(guard));

  // ---- DREAD: uncapped count, saturating slow -----------------------------
  const dread = await page.evaluate(() => {
    startGame(true, 'psy');
    const e = state.enemy;
    const at = stacks => {
      removeStatus(e, 'dread');
      applyStatus(e, 'dread', { stacks });
      const d = STATUSES.dread;
      return { stacks: statusStacks(e, 'dread'),
               aps: +d.apsMult(e, getStatus(e, 'dread')).toFixed(4),
               vuln: +d.incomingMult(e, getStatus(e, 'dread')).toFixed(4) };
    };
    return { six: at(6), twenty: at(20), absurd: at(500) };
  });
  ok('DREAD stacks past the old cap of 6', dread.twenty.stacks === 20, JSON.stringify(dread.twenty));
  ok('the open guard keeps climbing with the count',
     dread.absurd.vuln > dread.twenty.vuln && dread.twenty.vuln > dread.six.vuln,
     JSON.stringify([dread.six.vuln, dread.twenty.vuln, dread.absurd.vuln]));
  // The one reason the cap existed. An unbounded slow is a stun nobody paid for.
  ok('the slow saturates instead of running away',
     dread.absurd.aps === dread.twenty.aps && dread.absurd.aps > 0,
     JSON.stringify([dread.six.aps, dread.twenty.aps, dread.absurd.aps]));
  ok('a marked enemy never stops acting entirely', dread.absurd.aps >= 0.2,
     String(dread.absurd.aps));

  // ---- POISON and BLEED: the twins share one shape ------------------------
  const ailments = await page.evaluate(() => {
    startGame(true, 'bio');
    const e = state.enemy;
    applyStatus(e, 'poison', { stacks: 300, perStack: 1 });
    applyStatus(e, 'bleed', { stacks: 300, perStack: 1 });
    return { poison: statusStacks(e, 'poison'), bleed: statusStacks(e, 'bleed') };
  });
  ok('POISON is uncapped', ailments.poison === 300, String(ailments.poison));
  ok('BLEED is uncapped too, like its twin', ailments.bleed === 300, String(ailments.bleed));

  // ---- Every strain's number reaches the badge row ------------------------
  // The mechanics are only legible now because they are all statuses. If one
  // stopped rendering there it would be invisible rather than merely ugly.
  const badges = await page.evaluate(() => {
    const out = {};
    for (const [cls, id, on] of [['base','resolve','self'], ['psy','dread','foe'],
                                 ['bio','poison','foe']]) {
      startGame(true, cls);
      const unit = on === 'self' ? state.player : state.enemy;
      applyStatus(unit, id, { stacks: 12, perStack: 3 });
      out[cls] = buildStatusesHtml(unit).includes(STATUSES[id].name);
    }
    startGame(true, 'sym');
    state.player.thornsGrown = 30; applyDerivedStats(state.player);
    out.sym = buildStatusesHtml(state.player).includes('THORNS');
    return out;
  });
  for (const cls of ['base', 'psy', 'bio', 'sym'])
    ok(cls + "'s number is worn as a badge", badges[cls], JSON.stringify(badges));

  // ---- The bot lost its cap-relative threshold ----------------------------
  // "60% of the cap" cannot survive the cap, so the number moved onto the skill
  // as spendAt. A spender with no threshold would be dumped on one stack.
  const spenders = await page.evaluate(() =>
    Object.values(CLASSES).flatMap(c => c.skills)
      .filter(s => s.consumesDread || s.consumesResolve)
      .map(s => ({ id: s.id, spendAt: s.spendAt })));
  ok('every spender names when it is worth pressing',
     spenders.length > 0 && spenders.every(s => s.spendAt > 0), JSON.stringify(spenders));
}
