// Sym's ramp: THORNS is one number, it grows by being hit, and it is the only
// thing the class spends.
//
// A fast suite through simulateRun rather than a browser one — this is pure
// rules (growth, a heal's cost, a telegraph being baited), and the seams the
// browser suites exist for are elsewhere. It asserts the SHAPE of each rule
// rather than any particular constant, so the numbers stay the owner's to move
// by feel without turning this file red.
//
// Every claim here is one the rework makes out loud:
//   - being hit grows you, with no window and no condition (the old kit only
//     paid inside Raise Spines, three turns in every seven);
//   - growth is RUN-permanent, so a fight does not hand it back;
//   - Shed's fraction is a CEILING, not a price — a huge number must not turn
//     healing into an unpayable trade (see the balance header);
//   - Shed can never eat the innate share of max HP;
//   - Provoke buys the enemy a swing that cannot be dodged, and drags a charged
//     telegraph out early — as an ordinary hit when it baits, and as a spoiled
//     (part-strength) one when the boss shrugs the bait off.
export default async function ({ page, ok, say }) {

  // ---- Growth -------------------------------------------------------------
  const grew = await page.evaluate(() => {
    const r = simulateRun('sym', { keepLog: true, stopWhen: s => s.wave > 3 });
    const seen = [];
    for (const l of r.log) {
      const m = l.match(/^THORNS \+(\d+)\s+\((\d+)\)/);
      if (m) seen.push(+m[2]);
    }
    return { seen, first: seen[0], last: seen[seen.length - 1] };
  });
  ok('being hit grows THORNS', grew.seen.length > 0, JSON.stringify(grew.seen.slice(0, 8)));
  say('THORNS growth events in one fight', grew.seen.length);
  ok('THORNS ends bigger than it started', grew.last > grew.first,
     grew.first + ' -> ' + grew.last);

  // NO WINDOW AND NO CONDITION — the half that used to live inside Raise
  // Spines. Asserted head-on rather than read out of a transcript: a bot that
  // mashes keeps the window up permanently, so a log can genuinely contain zero
  // unspined hits while the rule underneath is perfectly correct.
  const unspined = await page.evaluate(() => {
    startGame(true, 'sym');
    const p = state.player, e = state.enemy;
    removeStatus(p, 'spines');
    p.evadeChance = 0; p.blockChance = 0;         // make the hit land, every time
    const before = p.thornsGrown || 0;
    applyEnemyDamage(e, p, 1);
    return { spines: hasStatus(p, 'spines'), gained: (p.thornsGrown || 0) - before };
  });
  ok('a hit with no Spines up still grows THORNS',
     unspined.gained > 0 && !unspined.spines, JSON.stringify(unspined));

  // RUN-PERMANENT: a kill must not hand the number back. Not asserted as
  // monotonic — Shed legitimately spends it — but once grown it must never
  // return to nothing, which is what a per-fight reset would look like.
  const acrossFights = await page.evaluate(() => {
    const marks = [];
    simulateRun('sym', { stopWhen: s => {
      if (s.player && s.player.class === 'sym') marks.push([s.wave, s.player.thornsGrown || 0]);
      return s.wave > 4;
    } });
    return marks;
  });
  const firstPositive = acrossFights.findIndex(([, g]) => g > 0);
  const waves = new Set(acrossFights.map(([w]) => w));
  ok('the run really crossed several fights', waves.size > 2, JSON.stringify([...waves]));
  ok('growth survives every kill in the run',
     firstPositive >= 0 && acrossFights.slice(firstPositive).every(([, g]) => g > 0),
     JSON.stringify(acrossFights.filter((_, i) => i % 7 === 0)));

  // ---- Shed: the fraction is a ceiling, not a price ------------------------
  // The trap this guards: healing is bounded by max HP while a percentage cost
  // is not, so an uncapped ramp would eventually buy a heal it cannot hold.
  const shed = await page.evaluate(() => {
    const mk = grown => {
      const p = freshPlayer('sym');
      p.thornsGrown = grown;
      applyDerivedStats(p);
      p.hp = Math.floor(p.maxHp * 0.5);          // half a bar missing, every time
      return p;
    };
    const fire = p => {
      const skill = p.skills.find(s => s.id === 'shed');
      const before = { grown: p.thornsGrown, hp: p.hp };
      fireSkill(p, Object.assign({}, skill, { cd: 0 }), p);
      return { spent: before.grown - p.thornsGrown, healed: p.hp - before.hp,
               grown: p.thornsGrown, hp: p.hp, maxHp: p.maxHp };
    };
    return { small: fire(mk(10)), mid: fire(mk(60)), huge: fire(mk(5000)) };
  });
  ok('Shed spends THORNS', shed.mid.spent > 0, JSON.stringify(shed.mid));
  // THE HEADLINE. A price would scale with the pile; a ceiling does not.
  ok('a huge THORNS pile does not cost more to heal the same wound',
     shed.huge.spent <= shed.mid.spent,
     'mid spent ' + shed.mid.spent + ', huge spent ' + shed.huge.spent);
  ok('a huge pile still heals at least as well as a small one',
     shed.huge.healed >= shed.small.healed,
     JSON.stringify({ small: shed.small.healed, huge: shed.huge.healed }));
  ok('Shed never overshoots the bar', shed.huge.hp <= shed.huge.maxHp,
     JSON.stringify(shed.huge));
  ok('Shed leaves the pile it did not need', shed.huge.grown > 0, JSON.stringify(shed.huge));
  // The innate share of max HP is a floor: spending everything must not leave
  // you blunt.
  const floor = await page.evaluate(() => {
    const p = freshPlayer('sym');
    p.thornsGrown = 0; applyDerivedStats(p);
    p.hp = 1;
    const skill = p.skills.find(s => s.id === 'shed');
    fireSkill(p, Object.assign({}, skill, { cd: 0 }), p);
    return { thorns: p.thorns, grown: p.thornsGrown };
  });
  ok('an ungrown sym still has innate THORNS after shedding', floor.thorns > 0,
     JSON.stringify(floor));
  ok('shedding cannot drive the pile negative', floor.grown >= 0, JSON.stringify(floor));

  // ---- Provoke: the invitation --------------------------------------------
  const provoked = await page.evaluate(() => {
    // SEVERAL RUNS, NOT ONE. Provoke's second mode needs a telegraph to bait,
    // which means reaching the first boss — and one run that dies on wave 4
    // reports "Provoke is never cast" about a skill that works fine. A check
    // that depends on a single run's luck fails at random, and a suite that
    // fails at random gets ignored, which is how a real break walks past.
    const lines = [];
    for (let n = 0; n < 5; n++)
      lines.push(...simulateRun('sym', Object.assign({ keepLog: true }, BOTS.skilled)).log);
    let cast = 0, bared = 0, baited = 0, heavyAfterBait = 0, sawBait = false;
    for (const l of lines) {
      if (/^Provoke\s+guard bared/.test(l)) cast++;
      if (/GUARD BARED/.test(l)) bared++;
      if (/^BAITED/.test(l)) { baited++; sawBait = true; continue; }
      // A baited charge must come out ORDINARY — checked against the swing that
      // BAITED actually produced, which is the next blow the player takes and
      // nothing later. Scoped to the following line only: left open, a
      // legitimate windup three turns downstream read as a violation.
      if (/→ You/.test(l)) {
        if (sawBait && /^HEAVY ×/.test(l)) heavyAfterBait++;
        sawBait = false;
      }
    }
    return { cast, bared, baited, heavyAfterBait };
  });
  ok('Provoke is actually reached in a run', provoked.cast > 0, JSON.stringify(provoked));
  ok('a provoked swing always lands', provoked.bared >= provoked.cast, JSON.stringify(provoked));
  ok('a baited charge never lands as a HEAVY', provoked.heavyAfterBait === 0,
     JSON.stringify(provoked));

  // Baiting head-on: hand the enemy a charge and provoke it.
  const bait = await page.evaluate(() => {
    startGame(true, 'sym');
    const p = state.player, e = state.enemy;
    e.windup = true; e.stunImmune = false;
    const hpBefore = p.hp;
    const skill = p.skills.find(s => s.id === 'provoke');
    fireSkill(p, Object.assign({}, skill, { cd: 0 }), e);
    return { windup: e.windup, resistArmed: !!e.stunImmune,
             took: hpBefore - p.hp, ordinary: e.damage, heavy: e.damage * BALANCE.enemy.windupMult };
  });
  ok('Provoke spends the charge', bait.windup === false, JSON.stringify(bait));
  ok('Provoke arms stagger resist, so a boss cannot be locked out',
     bait.resistArmed, JSON.stringify(bait));
  ok('the baited swing lands small, not heavy', bait.took < bait.heavy, JSON.stringify(bait));

  // The shrug: into an armed resist the charge is SPOILED rather than baited.
  // It used to hold, which punished the cast twice — the enemy got a free
  // ordinary swing AND the heavy was still on its way, so sym's only answer to
  // a telegraph was worse than doing nothing on every second one. Now the
  // charge comes out here and now, at a share of its size, on the turn the
  // player chose. Still a real failure (the blow lands, and it is bigger than
  // an ordinary hit), just not a free hit for the boss.
  const shrug = await page.evaluate(() => {
    // REPEATED, AND THE BIGGEST BLOW IS THE READING. Zeroing the dice does not
    // work here: Provoke grows THORNS, growth calls applyDerivedStats, and that
    // recomputes block chance straight back to 10% before the swing resolves.
    // A block halves the blow, and a halved spoiled charge lands for exactly an
    // ordinary hit — so this check failed roughly one run in ten while the
    // rules were perfectly correct. Blocks only ever REDUCE, so the largest of
    // several attempts is the unblocked number, and twelve attempts miss it
    // once in a trillion.
    let took = 0, ordinary = 0, heavy = 0, windup = null, resistArmed = null;
    for (let n = 0; n < 12; n++) {
      startGame(true, 'sym');
      const p = state.player, e = state.enemy;
      e.windup = true; e.stunImmune = true;
      // Survive it, so the numbers can be read. Bought with VITALITY rather than
      // by writing maxHp, because growth recomputes the sheet and would throw a
      // hand-written maxHp away mid-swing. Kept modest and paired with an
      // unkillable enemy for the same reason: sym's innate thorns are a
      // twentieth of max HP, so a huge bar reflects hard enough to kill the
      // enemy outright, and the kill would be what was actually measured.
      e.maxHp = e.hp = 1e9;
      p.vit = 100; applyDerivedStats(p); p.hp = p.maxHp;
      const hpBefore = p.hp;
      const skill = p.skills.find(s => s.id === 'provoke');
      fireSkill(p, Object.assign({}, skill, { cd: 0 }), e);
      took = Math.max(took, hpBefore - p.hp);
      ordinary = e.damage; heavy = e.damage * windupMultFor(e);
      // The charge state is the same every attempt; keep the first reading.
      if (windup === null) { windup = e.windup; resistArmed = !!e.stunImmune; }
    }
    return { windup, resistArmed, took, ordinary, heavy };
  });
  ok('a resisted Provoke drags the charge out now', shrug.windup === false, JSON.stringify(shrug));
  ok('the shrug consumes the resist', shrug.resistArmed === false, JSON.stringify(shrug));
  ok('a spoiled charge lands harder than an ordinary hit',
     shrug.took > shrug.ordinary, JSON.stringify(shrug));
  ok('...and softer than the telegraph it answered',
     shrug.took < shrug.heavy, JSON.stringify(shrug));

  // ---- The wallet is gone -------------------------------------------------
  const wallet = await page.evaluate(() => ({
    ids: CLASSES.sym.skills.map(s => s.id),
    readout: (() => { startGame(true, 'sym'); return strainReadout(state.player); })()
  }));
  ok('the kit is latch / spines / shed / provoke',
     wallet.ids.join(',') === 'latch,spines,shed,provoke', wallet.ids.join(','));
  ok('THORNS is the strain readout', wallet.readout && wallet.readout.label === 'Thorns',
     JSON.stringify(wallet.readout));
}
