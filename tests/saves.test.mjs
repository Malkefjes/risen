// Run state must be fully reset between runs, and two save slots must stay
// independent.
//
// The reset half exists because a finished run's chain counter used to survive
// into the next one: state.combo was zeroed but the meter that displays it is a
// DOM element nothing repainted until the next kill. Hence the assertions on
// what is ON SCREEN, not just what is in state.
export default async function ({ page, ctx, ok }) {
  const screen = () => page.evaluate(() => document.querySelector('.screen.active')?.id);
  const S = k => page.evaluate(k => state[k], k);
  const slots = () => page.evaluate(() => slotNumbers().map(n => {
    const d = window.slotData(n);
    return d ? { slot: n, classId: d.classId, wave: d.wave } : null;
  }));
  // Drive a run in via the real buttons, skipping only the 3.6s cinematic reveal.
  async function startRun(cls) {
    await page.click('#intro-screen .btn-evolve');
    await page.click('.class-card.' + cls);
    await page.evaluate(() => window.startGame(true));
    await page.waitForFunction(() => state.player && state.combatActive);
  }
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');   // NEW GAME
  await startRun('psy');

  // Reproduce the end state of a run with a live chain, the way onEnemyDefeated
  // leaves it: dirty every field startGame is supposed to put back.
  await page.evaluate(() => {
    Object.assign(state, {
      combo: 7, bestCombo: 7, kills: 9, wave: 6, damageDealt: 4321,
      enemyActions: 5, fightTurns: 22, overkillCarry: 40,
      talentQueue: [10], _lastOverkill: 12, _defeatLock: true, awaitingSpawn: true
    });
    window.updateCombo();
    window.log('stale line from the previous run');
    window.floatText(state.player, 999, 'damage');
  });
  const meterBefore = await page.evaluate(() => document.getElementById('combo-meter').textContent);
  ok('chain meter is showing before restart', meterBefore === '7× CHAIN', JSON.stringify(meterBefore));

  // Menu -> NEW GAME -> MUTATE -> bio -> EVOLVE, exactly the path described.
  await page.click('.sidebar-tab[data-tab="menu"]');
  await page.click('#tab-menu .btn-ghost');                          // SAVE & QUIT TO MENU
  ok('back on title screen', await screen() === 'title-screen');
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');   // NEW GAME
  await startRun('bio');

  const after = await page.evaluate(() => ({
    meterText: document.getElementById('combo-meter').textContent,
    meterShown: getComputedStyle(document.getElementById('combo-meter')).display !== 'none',
    meterHot: document.getElementById('combo-meter').classList.contains('hot'),
    logLines: document.getElementById('combat-log').textContent,
    floaters: document.querySelectorAll('.float-dmg').length,
    s: {
      combo: state.combo, bestCombo: state.bestCombo, kills: state.kills,
      damageDealt: state.damageDealt, overkillCarry: state.overkillCarry,
      talentQueue: state.talentQueue.length, talentOffers: state.talentOffers,
      _lastOverkill: state._lastOverkill, _defeatLock: state._defeatLock,
      wave: state.wave, klass: state.player.class, level: state.player.level
    }
  }));
  ok('combo meter hidden on new run', !after.meterShown);
  ok('combo meter text cleared', after.meterText === '', JSON.stringify(after.meterText));
  ok('combo meter "hot" class cleared', !after.meterHot);
  ok('state.combo reset', after.s.combo === 0);
  ok('state.bestCombo reset', after.s.bestCombo === 0);
  ok('state.kills reset', after.s.kills === 0);
  ok('state.damageDealt reset', after.s.damageDealt === 0);
  ok('state.overkillCarry reset', after.s.overkillCarry === 0);
  ok('state.talentQueue reset', after.s.talentQueue === 0);
  ok('state._lastOverkill reset', after.s._lastOverkill === 0);
  ok('state._defeatLock reset', after.s._defeatLock === false);
  ok('wave back to 1', after.s.wave === 1);
  ok('new strain applied', after.s.klass === 'bio');
  ok('player is level 1', after.s.level === 1);
  ok('stale log line gone', !after.logLines.includes('stale line'));
  ok('stale floaters cleared', after.floaters === 0);
  await page.evaluate(() => { state.combo = 5; window.updateCombo(); window.saveRun(); });
  await page.click('.sidebar-tab[data-tab="menu"]');
  await page.click('#tab-menu .btn-ghost');
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:not(.empty) .save-slot-body');
  await page.waitForFunction(() => state.player && state.combatActive);
  ok('chain meter hidden after continue', await page.evaluate(
    () => getComputedStyle(document.getElementById('combo-meter')).display === 'none'));
  ok('state.combo 0 after continue', await S('combo') === 0);
  await ctx.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.startGame === 'function');

  ok('LOAD disabled with no saves', await page.isDisabled('#continue-btn'));

  // Run 1 -> should silently take slot 1
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  ok('free slot skips the picker', await screen() === 'intro-screen');
  await startRun('bio');
  ok('run 1 claimed slot 1', await S('saveSlot') === 1);
  await page.evaluate(() => { state.wave = 4; window.saveRun(); });
  await page.click('.sidebar-tab[data-tab="menu"]');
  await page.click('#tab-menu .btn-ghost');

  // Run 2 -> should silently take slot 2, leaving slot 1 alone
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  ok('second free slot also skips the picker', await screen() === 'intro-screen');
  await startRun('sym');
  ok('run 2 claimed slot 2', await S('saveSlot') === 2);
  await page.evaluate(() => { state.wave = 9; window.saveRun(); });
  await page.click('.sidebar-tab[data-tab="menu"]');
  await page.click('#tab-menu .btn-ghost');

  let s = await slots();
  ok('slot 1 holds run 1 intact', s[0]?.classId === 'bio' && s[0]?.wave === 4, JSON.stringify(s[0]));
  ok('slot 2 holds run 2', s[1]?.classId === 'sym' && s[1]?.wave === 9, JSON.stringify(s[1]));

  // Load screen lists both
  await page.click('#continue-btn');
  ok('load screen lists 2 slots', await page.locator('#save-list .save-slot').count() === 2);
  ok('both slots are filled', await page.locator('#save-list .save-slot.empty').count() === 0);
  ok('load screen labels slots', (await page.locator('#save-list .save-slot-num').allTextContents()).join('|') === 'SLOT 1|SLOT 2');

  // Both full -> NEW GAME asks nothing and silently targets slot 1
  await page.click('#load-screen .btn-ghost');
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  ok('both slots full -> straight to intro, no picker', await screen() === 'intro-screen');
  s = await slots();
  ok('reaching the intro destroys nothing', s[0]?.wave === 4 && s[1]?.wave === 9);

  // Backing out of the intro must also destroy nothing — the slot is only
  // claimed when the run actually starts.
  await page.click('#intro-screen .btn-ghost');
  s = await slots();
  ok('backing out of the intro destroys nothing', s[0]?.wave === 4 && s[1]?.wave === 9);

  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  await startRun('psy');
  ok('new run claimed slot 1', await S('saveSlot') === 1);
  s = await slots();
  ok('slot 1 overwritten by the new run', s[0]?.classId === 'psy' && s[0]?.wave === 1, JSON.stringify(s[0]));
  ok('slot 2 untouched by the overwrite', s[1]?.classId === 'sym' && s[1]?.wave === 9, JSON.stringify(s[1]));

  // Load the OTHER slot while a run is live
  await page.click('.sidebar-tab[data-tab="menu"]');
  await page.click('#tab-menu .btn-ghost');
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:nth-child(2) .save-slot-body');
  await page.waitForFunction(() => state.player && state.combatActive);
  ok('loaded slot 2 by click', await S('saveSlot') === 2);
  ok('loaded slot 2 restored its wave', await S('wave') === 9);
  ok('loaded slot 2 restored its strain', await page.evaluate(() => state.player.class) === 'sym');
  // and it saves back to its own slot, not slot 1
  await page.evaluate(() => { state.wave = 11; window.saveRun(); });
  s = await slots();
  ok('loaded run saves back to its own slot', s[1]?.wave === 11 && s[0]?.wave === 1, JSON.stringify(s));
  await page.click('.sidebar-tab[data-tab="menu"]');
  await page.click('#tab-menu .btn-ghost');
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:nth-child(1) .save-slot-del');
  ok('first delete click only arms', (await slots())[0] !== null);
  ok('armed button asks for confirmation',
     (await page.locator('#save-list .save-slot:nth-child(1) .save-slot-del').textContent()) === 'SURE?');
  await page.click('#save-list .save-slot:nth-child(1) .save-slot-del');
  s = await slots();
  ok('second delete click removes the run', s[0] === null, JSON.stringify(s[0]));
  ok('delete leaves the other slot alone', s[1]?.wave === 11);
  ok('emptied slot still listed', await page.locator('#save-list .save-slot.empty').count() === 1);
  ok('emptied slot is not clickable', await page.isDisabled('#save-list .save-slot:nth-child(1) .save-slot-body'));
  ok('arming resets on reopen', await page.evaluate(() => {
    window.deleteSlot(2); window.openLoadScreen();
    return document.querySelector('#save-list .save-slot-del').textContent === '×';
  }));

  // A freed slot means no picker again
  await page.click('#load-screen .btn-ghost');
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  ok('freed slot skips the picker again', await screen() === 'intro-screen');
  await page.click('#intro-screen .btn-ghost');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(slotKey(1), JSON.stringify({
      v: 2, classId: 'bio', wave: 7, kills: 6, bestCombo: 3,
      player: { level: 4, str: 9, instinct: 5, speed: 5, vit: 6, hp: 80, maxHp: 120,
                dmgMult:1, hpMult:1, apsMult:1, talents:{}, talentIds: [], statuses: [],
                skillCds: [0,0,0,0] }
    }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.startGame === 'function');
  s = await slots();
  ok('a v4 save is listed', s[0]?.classId === 'bio' && s[0]?.wave === 7, JSON.stringify(s[0]));
  ok('LOAD enabled for it', !(await page.isDisabled('#continue-btn')));
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:nth-child(1) .save-slot-body');
  await page.waitForFunction(() => state.player && state.combatActive);
  ok('it loads and plays', await S('wave') === 7 && await page.evaluate(() => state.player.level) === 4);
  await page.evaluate(() => { SETTINGS.fastTurns = true; });
  for (let i = 0; i < 25; i++) {
    const fired = await page.evaluate(() => {
      if (!state.awaitingInput || !state.combatActive) return false;
      const s = state.player.skills.find(s => !s.basic && s.cd <= 0) || state.player.skills[0];
      window.playerAct(s); return true;
    });
    await page.waitForTimeout(fired ? 260 : 130);
  }
  const live = await page.evaluate(() => ({ wave: state.wave, kills: state.kills, dmg: state.damageDealt, hp: state.player.hp }));
  ok('combat runs and deals damage', live.dmg > 0, JSON.stringify(live));
}
