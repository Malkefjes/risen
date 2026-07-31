// UNMUTATED'S WOUND — bleed, and the two rules that stop it being bio in red.
//
// Base is the only strain with two numbers: RESOLVE on himself, BLEED on them.
// That is allowed because one FEEDS the other — a cut is only as deep as the
// grit behind it — rather than being a second currency to manage. This suite
// guards the parts of that which would rot silently:
//
//   the depth      a cut reads held RESOLVE at the moment it is made
//   the newest     spending Resolve shallows the cuts that come AFTER, which is
//                  the price that makes hold-vs-spend a real question. Under the
//                  default (highest-wins) rule one deep strike would set the
//                  depth for the whole fight and the decision would evaporate.
//   the timer      each stack refreshes the wound; stop cutting and it closes.
//                  This is half of what separates a cut from the rot, and it is
//                  a one-word change away from becoming permanent by accident.
//   the ledger     an ailment tick is damage the PLAYER dealt. It was not being
//                  counted at all, which under-reported bio by ~4x for as long
//                  as poison has been its ramp.
export default async function ({ page, ok }) {

  // ---- Depth rides Resolve ------------------------------------------------
  const depth = await page.evaluate(() => {
    startGame(true, 'base');
    const p = state.player;
    const at = held => {
      removeStatus(p, 'resolve');
      if (held) applyStatus(p, 'resolve', { stacks: held });
      applyDerivedStats(p);
      return bleedDepth(p);
    };
    return { none: at(0), ten: at(10), forty: at(40), sheet: (at(10), p.bleedDamage) };
  });
  ok('a cut with no RESOLVE behind it still bleeds', depth.none >= 1, JSON.stringify(depth));
  ok('held RESOLVE deepens the cut', depth.ten > depth.none, JSON.stringify(depth));
  ok('and keeps deepening — no ceiling on the depth', depth.forty > depth.ten,
     JSON.stringify(depth));
  ok('the sheet reports the cut it would actually make', depth.sheet === depth.ten,
     JSON.stringify(depth));

  // ---- Newest cut wins ----------------------------------------------------
  // The owner's call, and the whole reason spending Resolve costs anything.
  const newest = await page.evaluate(() => {
    startGame(true, 'base');
    const p = state.player, e = state.enemy;
    p.evadeChance = 0;
    const strike = Object.assign({}, p.skills.find(s => s.id === 'jab'), { cd: 0 });
    applyStatus(p, 'resolve', { stacks: 30 });   // cut deep
    applyDerivedStats(p);
    applyPlayerDamage(p, e, strike);
    const deep = getStatus(e, 'bleed').perStack;
    removeStatus(p, 'resolve', 'spent');          // ...then spend it all
    applyDerivedStats(p);
    applyPlayerDamage(p, e, strike);              // ...and cut again
    const after = getStatus(e, 'bleed').perStack;
    return { deep, after, stacks: statusStacks(e, 'bleed') };
  });
  ok('a deep cut is deep', newest.deep > 1, JSON.stringify(newest));
  ok('spending RESOLVE shallows the wound — newest cut sets the depth',
     newest.after < newest.deep, JSON.stringify(newest));
  ok('the stacks themselves still accumulate', newest.stacks === 2, JSON.stringify(newest));
  // The default rule must survive for poison, whose per-stack only ever climbs
  // and which must not be thinnable.
  const poisonRule = await page.evaluate(() => {
    startGame(true, 'bio');
    const e = state.enemy;
    applyStatus(e, 'poison', { stacks: 1, perStack: 20 });
    applyStatus(e, 'poison', { stacks: 1, perStack: 3 });
    return getStatus(e, 'poison').perStack;
  });
  ok('poison still keeps its deepest, so nothing can thin the rot', poisonRule === 20,
     String(poisonRule));

  // ---- The timer separates a cut from the rot -----------------------------
  const timer = await page.evaluate(() => {
    startGame(true, 'base');
    const e = state.enemy;
    e.maxHp = 1e9; e.hp = 1e9;
    applyStatus(e, 'bleed', { stacks: 3, perStack: 5, duration: BALANCE.player.bleedDuration });
    const start = getStatus(e, 'bleed').duration;
    // THE WOUND RUNS ON THE CUTTER'S CLOCK, so the enemy's own turns do
    // nothing to it — that is the whole point of the second clock, and this is
    // the assertion that would catch it silently moving back.
    for (let i = 0; i < BALANCE.player.bleedDuration + 1; i++) tickStatuses(e);
    const survivedFoeTurns = hasStatus(e, 'bleed');
    // Tick it out on the cutter's clock, with nobody re-cutting.
    for (let i = 0; i < BALANCE.player.bleedDuration + 1; i++) tickStatuses(e, 'inflicted');
    const closed = !hasStatus(e, 'bleed');
    // Now re-cut mid-wound and confirm the timer resets.
    applyStatus(e, 'bleed', { stacks: 1, perStack: 5, duration: BALANCE.player.bleedDuration });
    tickStatuses(e, 'inflicted');
    applyStatus(e, 'bleed', { stacks: 1, perStack: 5, duration: BALANCE.player.bleedDuration });
    const refreshed = getStatus(e, 'bleed').duration;
    return { start, closed, refreshed, survivedFoeTurns,
             permanent: !!STATUSES.bleed.permanent };
  });
  ok('the enemy cannot wait a wound out on its own turns', timer.survivedFoeTurns,
     JSON.stringify(timer));
  ok('a wound left alone closes', timer.closed, JSON.stringify(timer));
  ok('bleed is never permanent — that is poison', timer.permanent === false);
  ok('cutting again reopens the full timer', timer.refreshed === timer.start,
     JSON.stringify(timer));

  // ---- The ledger ---------------------------------------------------------
  // An ailment tick is damage dealt. This went uncounted entirely, so the
  // result screen and every simulateRun measurement under-reported bio by most
  // of its output.
  const ledger = await page.evaluate(() => {
    startGame(true, 'base');
    const e = state.enemy;
    e.maxHp = 1e9; e.hp = 1e9;
    applyStatus(e, 'bleed', { stacks: 4, perStack: 7, duration: 9 });
    const before = state.damageDealt;
    tickStatuses(e, 'inflicted');
    const fromBleed = state.damageDealt - before;

    // ...and an elite's venom ticking on YOU is not damage you dealt.
    startGame(true, 'base');
    const p = state.player;
    applyStatus(p, 'poison', { stacks: 3, perStack: 4 });
    const mine = state.damageDealt;
    tickStatuses(p, 'inflicted');
    return { fromBleed, selfTick: state.damageDealt - mine };
  });
  ok('a bleed tick counts as damage dealt', ledger.fromBleed === 28, JSON.stringify(ledger));
  ok('an ailment ticking on YOU counts for nothing', ledger.selfTick === 0,
     JSON.stringify(ledger));

  // ---- It reaches the fight ----------------------------------------------
  // The rules being right is not the same as the kit using them. Both of base's
  // sources have to actually fire in a real run.
  const live = await page.evaluate(() => {
    let strikeCut = 0, counterCut = 0, ticks = 0, peak = 0;
    for (let n = 0; n < 6; n++) {
      const r = simulateRun('base', Object.assign({ keepLog: true }, BOTS.skilled));
      let lastWasCounter = false;
      for (const l of r.log) {
        if (/^\+ BLEED/.test(l)) { lastWasCounter ? counterCut++ : strikeCut++; }
        lastWasCounter = /^COUNTER → /.test(l) || (lastWasCounter && /^\+ BLEED/.test(l));
        const m = l.match(/^BLEED → .*?×(\d+) @/);
        if (m) { ticks++; peak = Math.max(peak, +m[1]); }
      }
    }
    return { strikeCut, counterCut, ticks, peak };
  });
  ok('Strike opens wounds in a real run', live.strikeCut > 0, JSON.stringify(live));
  ok('the wound actually ticks', live.ticks > 20, JSON.stringify(live));
  ok('and it stacks well past a handful', live.peak >= 5, JSON.stringify(live));

  // Only base cuts. Bleed is his, the way poison is bio's.
  const whose = await page.evaluate(() =>
    Object.entries(CLASSES).map(([id, c]) => [id, c.skills.some(s => s.bleed || s.counterBleed)]));
  ok('bleed belongs to Unmutated alone',
     whose.every(([id, has]) => has === (id === 'base')), JSON.stringify(whose));

  // ---- Every mechanic named on a card wears its badge's colour ------------
  // Not a bleed rule, but this is where it bit: BLEED and DREAD were both live
  // and both named on cards while neither was in DESC_KEYWORDS, so they
  // rendered as ordinary prose. Nothing would ever have failed. Generic on
  // purpose — it walks the real card text, so a mechanic added later is caught
  // the moment it is mentioned.
  const words = await page.evaluate(() => {
    const named = new Set();
    for (const c of Object.values(CLASSES))
      for (const s of c.skills)
        for (const w of (s.desc || '').match(/\b[A-Z]{4,}\b/g) || []) named.add(w);
    // Names of statuses that actually exist are the ones that must be coloured;
    // shouted prose ("DEVOUR") is not a mechanic with a badge.
    const statuses = new Set(Object.values(STATUSES).map(d => d.name));
    const shouldColour = [...named].filter(w => statuses.has(w));
    return { shouldColour, missing: shouldColour.filter(w => !DESC_KEYWORDS[w]) };
  });
  ok('cards really do name mechanics', words.shouldColour.length >= 5,
     JSON.stringify(words.shouldColour));
  ok('every mechanic named on a card is coloured', words.missing.length === 0,
     'uncoloured: ' + JSON.stringify(words.missing));

  // ...and the colour must be the SAME one its badge uses, or the card and the
  // fighter panel disagree about what the word means.
  const matched = await page.evaluate(() => {
    // Two different ladders: a card word is `.kw.kw-<suffix>`, a badge is
    // `.status.<tone>`. Probing both with the same class name says nothing —
    // there is no `.kw-poison`, so the comparison silently measured the
    // default colour against itself.
    const probe = className => {
      const el = document.createElement('span');
      el.className = className;
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    };
    const out = [];
    for (const [word, suffix] of Object.entries(DESC_KEYWORDS)) {
      const def = Object.values(STATUSES).find(d => d.name === word);
      if (!def) continue;                       // RESOLVE-style words with no badge
      out.push([word, probe('kw kw-' + suffix), probe('status ' + (def.tone || def.kind))]);
    }
    return out;
  });
  ok('a keyword wears the same colour as its badge',
     matched.every(([, kw, badge]) => kw === badge), JSON.stringify(matched));
}
