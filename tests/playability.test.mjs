// THE FIRST BOSS, MEASURED. This suite USED TO DEMAND THINGS — that each class
// clear wave 5 at a stated rate, that the telegraph land inside a stated band —
// and that was a mistake worth writing down rather than just deleting.
//
// A threshold in here is a design decision wearing a test's clothes. When one
// trips, nobody learns that the boss got harder; they learn that something is
// red, and the reflex is to make it green. That is exactly what happened: base
// drifted to sitting on its 50% floor, the assertion became a coin flip, and
// the fix applied was to move the floor to 35%. The number never reached the
// owner as information — it arrived as a verdict that had already been argued
// with. A measurement you are allowed to negotiate with is not a measurement.
//
// So this suite now REPORTS. Every number it used to gate on, it prints. The
// game changed, here is what it does now, and the person who plays it decides
// whether wave 5 is a check or a wall. Nothing here can make that call, and
// nothing here should be edited to make a run look better.
//
// What it still CHECKS is one thing, and it is not a judgement: that the boss
// is actually being reached, so a clear rate of zero cannot quietly mean "died
// on wave 3" while reading as "the boss is impossible".
export default async function ({ page, ok, say }) {
  // ---- The telegraph against a fresh bar ---------------------------------
  // The number that made wave 5 a wall once: one telegraphed hit erasing a full
  // starting bar. Reported as a share, so "it one-shots a fresh sheet" and "it
  // barely tickles" are both visible without either being ruled out here.
  const burst = await page.evaluate(() => {
    // A fresh sheet, built through the real derived-stat path, not a guess.
    const fresh = { class: 'base', str: 5, instinct: 5, speed: 5, vit: 5, talents: {} };
    applyDerivedStats(fresh);
    const boss = makeEnemy(5);
    return { startHp: fresh.maxHp, bossHp: boss.hp, bossDmg: boss.damage,
             windup: Math.round(boss.damage * BALANCE.enemy.windupMult) };
  });
  say('first boss telegraph vs a fresh 5/5/5/5 bar',
      `${burst.windup} vs ${burst.startHp} HP  (${Math.round(burst.windup / burst.startHp * 100)}% of the bar)`);
  say('first boss, ordinary hit and HP', `${burst.bossDmg} damage, ${burst.bossHp} HP`);

  // ---- The clear rate -----------------------------------------------------
  // Both bots, because the CONTRAST is the information and a single rate hides
  // it. greedy mashes buttons; skilled plays four stated habits. A class that
  // clears at 100% played and 48% mashed is not the same finding as a class
  // that clears at 70% either way, and one number cannot tell those apart.
  const RUNS = 60;
  const clear = await page.evaluate((RUNS) => {
    const out = {};
    for (const bot of ['greedy', 'skilled']) {
      out[bot] = {};
      for (const cls of ['bio', 'sym', 'base', 'psy']) {
        let reachedBoss = 0, cleared = 0;
        for (let n = 0; n < RUNS; n++) {
          // stopWhen keeps this cheap: the question is wave 5, not the whole run.
          const r = simulateRun(cls, Object.assign({}, BOTS[bot], { stopWhen: s => s.wave >= 6 }));
          if (r.wave >= 5) reachedBoss++;
          if (r.wave >= 6) cleared++;
        }
        out[bot][cls] = { reachedBoss, cleared };
      }
    }
    return out;
  }, RUNS);
  for (const cls of ['bio', 'sym', 'base', 'psy']) {
    const g = clear.greedy[cls], s2 = clear.skilled[cls];
    const pct = r => r.reachedBoss ? Math.round(r.cleared / r.reachedBoss * 100) + '%' : '—';
    say(`first boss cleared as ${cls}`,
        `${pct(g)} mashed (${g.cleared}/${g.reachedBoss}),  ${pct(s2)} played (${s2.cleared}/${s2.reachedBoss})`);
  }

  // THE ONE CHECK LEFT, and it is not a judgement about difficulty: the rates
  // above are meaningless if the runs never got to wave 5, because "died on
  // wave 3" and "the boss is unbeatable" would print the same 0%. This says the
  // measurement measured something.
  const reaching = ['bio', 'sym', 'base', 'psy']
    .filter(c => clear.greedy[c].reachedBoss === 0 && clear.skilled[c].reachedBoss === 0);
  ok('the runs actually reach the first boss, so the rates above mean something',
     reaching.length === 0,
     reaching.length ? 'never reached it as: ' + reaching.join(', ') : '');
}
