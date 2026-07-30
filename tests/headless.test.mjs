// Headless mode must run THE SAME GAME, not a model of it.
//
// Everything measured about balance now comes through simulateRun, so the
// load-bearing assertion here is the equivalence check: seed Math.random, play
// the same fight headless and on-screen with the same policy, and require the
// two to agree exactly. If that ever drifts, every balance number this repo
// produces becomes fiction, silently.
//
// The rest guards the two ways a simulation could damage the real game: by
// writing to the player's save slots, or by moving the UI out from under them.
const SEED = `() => { window.__seed = 12345;
  Math.random = () => { window.__seed = (window.__seed * 1664525 + 1013904223) >>> 0;
                        return window.__seed / 4294967296; }; }`;

export default async function ({ page, ok }) {
  const r = await page.evaluate(() => simulateRun('sym', { keepLog: true }));
  ok('a run completes', !!r && r.wave > 1, JSON.stringify(r && { wave: r.wave, turns: r.turns }));
  ok('it reports a real sheet', r.derived.atk > 0 && r.derived.maxHp > 0, JSON.stringify(r.derived));
  ok('it took real turns', r.turns > 5, String(r.turns));
  ok('it dealt real damage', r.damageDealt > 0, String(r.damageDealt));
  ok('the transcript is captured', r.log.length > 20 && r.log[0].startsWith('RISEN'), String(r.log.length));
  ok('an unknown strain returns null', await page.evaluate(() => simulateRun('nope')) === null);

  // stopWhen, so a slice of a run can be measured rather than all of it.
  const sliced = await page.evaluate(() => simulateRun('sym', { stopWhen: s => s.wave > 3 }));
  ok('stopWhen ends the run early', sliced.wave <= 4 && !sliced.won, JSON.stringify({ wave: sliced.wave }));

  const safety = await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(slotKey(1), JSON.stringify({ v: 2, classId: 'bio', wave: 9, kills: 5,
      player: { level: 5, str: 9, instinct: 5, speed: 7, vit: 8, hp: 90, maxHp: 160, dmgMult: 1,
                hpMult: 1, apsMult: 1, talents: {}, talentIds: [], statuses: [], skillCds: [0,0,0,0] } }));
    goToMenu();
    const before = document.querySelector('.screen.active')?.id;
    for (let i = 0; i < 5; i++) simulateRun('psy');
    return { before, after: document.querySelector('.screen.active')?.id,
             savedWave: JSON.parse(localStorage.getItem(slotKey(1)) || '{}').wave,
             keys: Object.keys(localStorage).length,
             floaters: document.querySelectorAll('.float-dmg').length,
             logNodes: document.querySelectorAll('#combat-log .log-entry').length,
             flagCleared: HEADLESS.on === false };
  });
  ok('a sim does not move the UI', safety.before === safety.after, safety.before + ' -> ' + safety.after);
  ok('a sim does not touch the save slots', safety.savedWave === 9 && safety.keys === 1, JSON.stringify(safety));
  ok('a sim draws no floaters', safety.floaters === 0, String(safety.floaters));
  ok('a sim writes no log nodes', safety.logNodes === 0, String(safety.logNodes));
  ok('HEADLESS.on is restored afterwards', safety.flagCleared);

  // Cosmetic randomness must not share the rules' RNG stream. Drawing a damage
  // number used to advance the same sequence the next crit roll reads.
  const streams = await page.evaluate(() => {
    let calls = 0; const real = Math.random;
    Math.random = () => { calls++; return real(); };
    for (let i = 0; i < 50; i++) cosmeticRandom();
    Math.random = real;
    return calls;
  });
  ok('cosmeticRandom does not consume Math.random', streams === 0, String(streams));

  // ---- the equivalence proof ----
  // A WHOLE run, not a slice: turnNo is a per-fight counter that resets when a
  // wave spawns, so stopping at a wave boundary lands the two sides either
  // side of that reset and reports a difference that is not one. Costs ~25s,
  // and it is the assertion the whole balance-measurement story rests on.
  const head = await page.evaluate((s) => {
    eval('(' + s + ')()');
    const r = simulateRun('bio', { allocate: () => 'vit' });
    return { wave: r.wave, level: r.level, kills: r.kills, dmg: r.damageDealt,
             won: r.won, turns: r.turns, stats: r.stats, derived: r.derived };
  }, SEED);
  const live = await page.evaluate(async (s) => {
    eval('(' + s + ')()');
    localStorage.clear(); goToMenu(); startGame(true, 'bio'); SETTINGS.fastTurns = true;
    for (let i = 0; i < 40000; i++) {
      if (state.runOver) break;
      if (state.awaitingInput && state.combatActive) {
        const p = state.player;
        if (p.points > 0) adjustStat('vit', 1);
        else if (pendingTotal(p) > 0) commitStats();
        else if (state.talentOffers?.picks?.length) pickTalent(state.talentOffers.picks[0].id);
        else {
          const u = p.skills.filter(k => !k.basic && k.cd <= 0);
          playerAct(u[0] || p.skills[0]);
        }
      }
      await new Promise(r => setTimeout(r, 0));
    }
    const p = state.player;
    return { wave: state.wave, level: p.level, kills: state.kills,
             dmg: Math.floor(state.damageDealt), won: !!state.won, turns: state.turnNo,
             stats: { str: p.str, instinct: p.instinct, speed: p.speed, vit: p.vit },
             derived: { atk: attackDamage(p), maxHp: p.maxHp, rate: +p.attackSpeed.toFixed(2) } };
  }, SEED);
  ok('>>> headless and on-screen play the identical game <<<',
     JSON.stringify(head) === JSON.stringify(live),
     'H ' + JSON.stringify(head) + '  L ' + JSON.stringify(live));
}
