// WHAT A TELEGRAPH COSTS, AND THAT AN ANSWER IS NEVER WASTED — one half
// reported, one half checked, and the split is the point.
//
// REPORTED: the telegraph's share of the bar it lands on. Every note in the
// enemy table reasoned about wave 5, where the pool is smallest, and concluded
// the multiplier was safe because the pool grows — but enemy damage grows
// faster, so the share climbed all run and the late-game telegraph quietly
// became a one-shot. That is worth watching at every boss and elite forever;
// it is not worth asserting, because "how much of your bar a boss may take" is
// the owner's call and a threshold here would make it silently mine.
//
// CHECKED: a shrugged answer. Bosses alternate stagger resistance so a stun or
// a Provoke cannot lock them out of a telegraph forever — but a TOTAL shrug
// meant psy and sym had their only answer deleted on every second one, while
// bio's Chitin and base's Brace (mitigation, not stagger) answered every one.
// A resisted answer now SPOILS the charge instead: it still lands, at a share.
// The failure mode this catches is the spoil silently becoming a full shrug
// again, which reads in play as "my button does nothing" and is invisible in
// any win rate.
export default async function ({ page, ok, say }) {

  // ---- The share of the bar ----------------------------------------------
  // REPORTED, NOT GATED. What a telegraph costs is the single number this whole
  // change was about, so it is exactly the number that must arrive as a fact
  // rather than as a pass mark somebody can move. Two yardsticks, because they
  // say different things: the bar an all-Vitality run arrives with, and the bar
  // a spread build arrives with. A blow at 60% of one and 130% of the other is
  // a statement about whether Vitality is doing its job — and a single ceiling
  // would have hidden it behind a tick.
  const shares = await page.evaluate(() => {
    const med = a => { a.sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
    const pools = {};
    for (const wave of [5, 10, 15]) {
      pools[wave] = {};
      for (const [plan, opts] of [['invested', { allocate: () => 'vit' }], ['spread', {}]]) {
        const runs = [];
        // Every strain, so the number is about the wave and not about one kit.
        for (const cls of ['bio', 'psy', 'sym', 'base']) {
          for (let n = 0; n < 6; n++) {
            const r = simulateRun(cls, Object.assign({}, BOTS.skilled, opts, {
              stopWhen: s => s.wave >= wave
            }));
            if (r && r.derived && r.wave >= wave) runs.push(r.derived.maxHp);
          }
        }
        pools[wave][plan] = med(runs);
      }
    }
    const out = [];
    for (const wave of [5, 10, 15]) {
      const e = makeEnemy(wave);
      if (e.isBoss) out.push({ label: 'wave ' + wave + ' boss', pools: pools[wave],
                               windup: Math.round(e.damage * windupMultFor(e)) });
    }
    // An elite is built by hand: makeEnemy ROLLS for one, and a measurement that
    // waits on a 16-40% roll is one that reports nothing on a bad day. Wave 13
    // against the wave-10 pool, since that is the bar you meet it with.
    const elite = makeEnemy(13);
    elite.elite = ELITES[Object.keys(ELITES)[0]];
    out.push({ label: 'wave 13 elite', pools: pools[10],
               windup: Math.round(elite.damage * windupMultFor(elite)) });
    return out;
  });
  for (const row of shares) {
    const of = (pool, what) => pool
      ? Math.round(row.windup / pool * 100) + '% of ' + what + ' (' + pool + ')'
      : 'no ' + what.replace(/^an? /, '') + ' run got this far';
    say(row.label + ' telegraph',
        `${row.windup} damage — ${of(row.pools.invested, 'an invested bar')}, `
        + `${of(row.pools.spread, 'a spread bar')}`);
  }

  // The two multipliers, side by side. They were split because you meet a dozen
  // elites a run and three bosses — but whether they SHOULD differ, and by how
  // much, is a design question, so this prints them and asks nothing.
  const mults = await page.evaluate(() => {
    const boss = makeEnemy(10);
    const elite = makeEnemy(13);
    elite.elite = ELITES[Object.keys(ELITES)[0]];
    return { boss: windupMultFor(boss), elite: windupMultFor(elite),
             spoil: BALANCE.enemy.windupSpoilFrac };
  });
  say('telegraph multipliers', `boss ×${mults.boss}, elite ×${mults.elite}, `
      + `spoiled answer keeps ×${mults.spoil} of it off`);

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
