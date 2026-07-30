// THE FIRST BOSS IS A CHECK, NOT A WALL.
//
// Wave 5 was where runs went to die — and not by a hair. The boss's telegraphed
// windup hit for 137 against a starting pool of 100, so a fresh sheet was
// one-shot by a blow it could see coming but rarely had the tools to fully
// answer that early, and the boss's own HP made the fight long enough to eat
// several of them. The greedy bot cleared it 18% of the time as Unmutated. You
// cannot feel a class you never get to play past its first boss.
//
// This suite guards the two numbers that made it a wall, so a later retune that
// re-hardens the boss trips here instead of in a play session. It is not a
// balance oracle — it does not claim wave 5 is TUNED, only that it is passable.
// Both are floors with wide headroom, in the spirit of the balance header:
// defaults with room, not laws.
//
// PSY IS DELIBERATELY EXCLUDED from the clear-rate check. Its bot dies at wave
// 2-3 to the Momentum drain, long before the boss, so a psy assertion here would
// measure the bot's inability to bank Momentum rather than anything about the
// boss — exactly the trap the project notes warn about. A human holds Momentum
// and does far better; the fix psy needs is its own class pass, not a boss knob.
export default async function ({ page, ok }) {
  // ---- The burst invariant ----------------------------------------------
  // The specific number that made wave 5 a wall: one telegraphed hit erasing a
  // full starting bar. A windup should cost you half your health and a turn
  // spent reacting — it must not delete the run off a hit you were shown.
  const burst = await page.evaluate(() => {
    // A fresh sheet, built through the real derived-stat path, not a guess.
    const fresh = { class: 'base', str: 5, instinct: 5, speed: 5, vit: 5, talents: {} };
    applyDerivedStats(fresh);
    const boss = makeEnemy(5);
    return { startHp: fresh.maxHp, bossHp: boss.hp, bossDmg: boss.damage,
             windup: Math.round(boss.damage * BALANCE.enemy.windupMult) };
  });
  ok('the first boss cannot one-shot a fresh sheet',
     burst.windup < burst.startHp,
     `windup ${burst.windup} vs starting HP ${burst.startHp}`);
  // And it should still HURT — a telegraph that tickles is not a check either.
  // At least a third of the bar, or the reaction it is asking for is optional.
  ok('the first boss windup still demands a response',
     burst.windup >= burst.startHp * 0.33,
     `windup ${burst.windup} vs starting HP ${burst.startHp}`);

  // ---- The clear rate -----------------------------------------------------
  // Beatable, measured by playing: the fraction of runs that get PAST wave 5.
  // For these three the greedy bot reaches the boss essentially every run, so
  // "reached wave 6+" reads straight as "cleared the first boss". The floor is
  // 50% against a measured ~80-100%, wide enough not to flake and tight enough
  // that winding the boss back up to its old numbers (base fell to 18%) fails.
  const RUNS = 40;
  const clear = await page.evaluate((RUNS) => {
    const out = {};
    for (const cls of ['bio', 'sym', 'base']) {
      let reachedBoss = 0, cleared = 0;
      for (let n = 0; n < RUNS; n++) {
        const r = simulateRun(cls);
        if (r.wave >= 5) reachedBoss++;
        if (r.wave > 5) cleared++;
      }
      out[cls] = { reachedBoss, cleared, rate: cleared / RUNS };
    }
    return out;
  }, RUNS);
  for (const cls of ['bio', 'sym', 'base'])
    ok(`the first boss is beatable as ${cls} (${clear[cls].cleared}/${RUNS} clear)`,
       clear[cls].rate >= 0.5,
       JSON.stringify(clear[cls]));

  // A sanity floor under the numbers above: if a class stopped reaching the boss
  // at all, its clear rate would read 0 and look like a boss problem when it was
  // an earlier one. Assert the boss is actually being TESTED.
  ok('runs actually reach the first boss',
     ['bio', 'sym', 'base'].every(c => clear[c].reachedBoss >= RUNS * 0.8),
     JSON.stringify(clear));
}
