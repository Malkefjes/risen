// A TELEGRAPH COSTS YOU HALF YOUR BAR, AND AN ANSWER IS NEVER WASTED.
//
// Two rules, both learned by dying to them in play, and both easy to undo by
// accident because each is one number in a table.
//
// FIRST: the telegraph's share of the bar it lands on. Every note in the enemy
// table reasoned about wave 5, where the pool is smallest, and concluded the
// multiplier was safe because the pool grows — but enemy damage grows faster,
// so the share climbed all run and the late-game telegraph became a one-shot
// (wave 13 elite: 235 against a ~200 bar). playability guards the FIRST boss;
// this guards the ones after it, and elites, which nothing was watching.
//
// SECOND: a shrugged answer. Bosses alternate stagger resistance so a stun or
// a Provoke cannot lock them out of a telegraph forever — but a TOTAL shrug
// meant psy and sym had their only answer deleted on every second one, while
// bio's Chitin and base's Brace (mitigation, not stagger) answered every one.
// A resisted answer now SPOILS the charge instead: it still lands, at a share.
// The failure mode this catches is the spoil silently becoming a full shrug
// again, which reads in play as "my button does nothing" and is invisible in
// any win rate.
export default async function ({ page, ok }) {

  // ---- The share of the bar ----------------------------------------------
  // THE YARDSTICK IS A SHEET THAT BOUGHT SURVIVAL, and that choice is the
  // whole meaning of the assertion. Measured against a SPREAD build the wave-15
  // telegraph is still 113% of the bar — and that is allowed, because a player
  // arriving at the last boss with 8 Vitality has made a build decision and
  // Vitality has to be able to be wrong. What must never happen is the other
  // thing: a player who DID invest in surviving being deleted anyway, which is
  // an outcome no decision can answer. So the pool here is what an all-Vitality
  // run actually arrives with, and every ceiling below is a claim about that.
  const shares = await page.evaluate(() => {
    const pools = {};
    for (const wave of [5, 10, 15]) {
      const runs = [];
      // Every strain, so the number is about the wave and not about one kit.
      for (const cls of ['bio', 'psy', 'sym', 'base']) {
        for (let n = 0; n < 8; n++) {
          const r = simulateRun(cls, Object.assign({}, BOTS.skilled, {
            allocate: () => 'vit',
            stopWhen: s => s.wave >= wave
          }));
          if (r && r.derived && r.wave >= wave) runs.push(r.derived.maxHp);
        }
      }
      runs.sort((a, b) => a - b);
      pools[wave] = runs.length ? runs[Math.floor(runs.length / 2)] : null;
    }
    const out = [];
    for (const wave of [5, 10, 15]) {
      const e = makeEnemy(wave);
      if (!e.isBoss || !pools[wave]) continue;
      out.push({ wave, pool: pools[wave],
                 windup: Math.round(e.damage * windupMultFor(e)) });
    }
    // An elite is built by hand: makeEnemy ROLLS for one, and a test that waits
    // on a 16-40% roll is a test that fails on a bad day. Wave 13 against the
    // wave-10 pool, since that is the bar you meet it with.
    const elite = makeEnemy(13);
    elite.elite = ELITES[Object.keys(ELITES)[0]];
    if (pools[10]) out.push({ wave: 13, elite: true, pool: pools[10],
                              windup: Math.round(elite.damage * windupMultFor(elite)) });
    return out;
  });
  ok('the pools were actually measured', shares.length === 4, JSON.stringify(shares));
  for (const row of shares) {
    const label = 'wave ' + row.wave + (row.elite ? ' elite' : ' boss');
    // Wide ceilings, in the spirit of the balance header: not a claim that the
    // number is TUNED, only that a telegraph costs a bar rather than ending a
    // run. Measured shares when this was written: 45% / 47% / 62% for the three
    // bosses and 39% for the elite, so there is real headroom before either
    // trips. An elite gets the tighter one because you meet a dozen a run.
    const ceiling = row.elite ? 0.65 : 0.85;
    ok(label + ' cannot erase an invested bar',
       row.windup < row.pool * ceiling,
       label + ': ' + row.windup + ' vs pool ' + row.pool
         + ' (' + Math.round(row.windup / row.pool * 100) + '%)');
  }

  // An elite telegraph must stay SMALLER than a boss's — the whole reason it
  // has its own multiplier is that you meet a dozen of them and three bosses.
  const mults = await page.evaluate(() => {
    const boss = makeEnemy(10);
    const elite = makeEnemy(13);
    elite.elite = ELITES[Object.keys(ELITES)[0]];
    return { boss: windupMultFor(boss), elite: windupMultFor(elite) };
  });
  ok('an elite telegraphs smaller than a boss', mults.elite < mults.boss,
     JSON.stringify(mults));

  // ---- A shrugged stun spoils the charge (psy) ----------------------------
  const stun = await page.evaluate(() => {
    startGame(true, 'psy');
    const p = state.player, e = state.enemy;
    // Survive the blow so it can be read, and make the enemy unkillable so a
    // kill (XP, a level, a fresh spawn) can never be what is measured instead.
    e.maxHp = e.hp = 1e9;
    p.vit = 100; applyDerivedStats(p); p.hp = p.maxHp;
    // Evade and block OFF. Every assertion below compares one blow against
    // another, and a 10% dodge silently reports a spoiled charge as a charge
    // that dealt nothing — which is the exact bug these tests exist to catch,
    // arriving as a coin flip. What is under test is the multiplier, not the
    // dice in front of it.
    p.evadeChance = 0; p.blockChance = 0;
    e.windup = true; e.stunImmune = true;    // resist armed: the answer will be shrugged
    const skill = p.skills.find(s => s.stun);
    // The stun is gated on DREAD, and the gate is not what is under test here.
    if (skill.dreadNeed) applyStatus(e, 'dread', { stacks: skill.dreadNeed });
    fireSkill(p, Object.assign({}, skill, { cd: 0 }), e);
    const spoiled = !!e.windupSpoiled;
    const hpBefore = p.hp;
    enemySwing(e);                           // the heavy it promised, now spoiled
    return { spoiled, resistArmed: !!e.stunImmune, took: hpBefore - p.hp,
             ordinary: e.damage, full: e.damage * BALANCE.enemy.windupMult };
  });
  ok('a shrugged stun spoils the charge', stun.spoiled, JSON.stringify(stun));
  ok('the shrug consumes the resist', stun.resistArmed === false, JSON.stringify(stun));
  ok('a spoiled heavy still hurts more than an ordinary hit',
     stun.took > stun.ordinary, JSON.stringify(stun));
  ok('...and lands softer than the telegraph it answered',
     stun.took < stun.full, JSON.stringify(stun));

  // ---- The resist still does its job -------------------------------------
  // The spoil must not quietly become a free interrupt: a boss cannot be
  // locked out of its telegraph, which is the entire reason the resist exists.
  const locked = await page.evaluate(() => {
    startGame(true, 'psy');
    const p = state.player, e = state.enemy;
    e.maxHp = e.hp = 1e9;
    p.vit = 100; applyDerivedStats(p); p.hp = p.maxHp;
    // Evade and block OFF. Every assertion below compares one blow against
    // another, and a 10% dodge silently reports a spoiled charge as a charge
    // that dealt nothing — which is the exact bug these tests exist to catch,
    // arriving as a coin flip. What is under test is the multiplier, not the
    // dice in front of it.
    p.evadeChance = 0; p.blockChance = 0;
    const skill = p.skills.find(s => s.stun);
    let landed = 0;
    for (let n = 0; n < 6; n++) {
      e.windup = true;
      applyStatus(e, 'dread', { stacks: (skill.dreadNeed || 1) });
      fireSkill(p, Object.assign({}, skill, { cd: 0 }), e);
      if (e.windup) { enemySwing(e); landed++; }   // it survived the answer
    }
    return { landed };
  });
  ok('a boss cannot be locked out of its telegraph', locked.landed >= 2,
     JSON.stringify(locked));

  // ---- A fresh charge is a whole one -------------------------------------
  // The spoil is spent by the blow it softened; the NEXT telegraph must arrive
  // at full weight or one answer would defang a boss for the rest of the fight.
  const fresh = await page.evaluate(() => {
    startGame(true, 'psy');
    const p = state.player, e = state.enemy;
    e.maxHp = e.hp = 1e9;
    p.vit = 100; applyDerivedStats(p); p.hp = p.maxHp;
    // Evade and block OFF. Every assertion below compares one blow against
    // another, and a 10% dodge silently reports a spoiled charge as a charge
    // that dealt nothing — which is the exact bug these tests exist to catch,
    // arriving as a coin flip. What is under test is the multiplier, not the
    // dice in front of it.
    p.evadeChance = 0; p.blockChance = 0;
    e.windup = true; e.windupSpoiled = true;
    enemySwing(e);                                  // spends the spoiled charge
    const carried = !!e.windupSpoiled;
    e.windup = true;                                // the next charge, untouched
    const hpBefore = p.hp;
    enemySwing(e);
    return { carried, took: hpBefore - p.hp,
             full: Math.floor(e.damage * windupMultFor(e)) };
  });
  ok('a spoiled charge does not carry over', fresh.carried === false,
     JSON.stringify(fresh));
  ok('the next telegraph arrives at full weight',
     fresh.took >= fresh.full * 0.9, JSON.stringify(fresh));
}
