// Bumping BALANCE.saveKey must drop older saves rather than migrate them.
//
// A save stores raw stats and recomputes the derived sheet on load, so carrying
// one across a rules change hands back a character allocated under economics
// that no longer exist. Empty slots are the honest outcome.
export default async function ({ page, ctx, ok }) {
  await page.evaluate(() => {
    localStorage.clear();
    const mk = (c,w,l) => JSON.stringify({ v:2, classId:c, wave:w, kills:3, bestCombo:2,
      player:{ level:l, str:9, instinct:5, speed:7, vit:8, hp:90, maxHp:160, dmgMult:1,
               hpMult:1, apsMult:1, talents:{}, talentIds:[], statuses:[], skillCds:[0,0,0,0] } });
    // Every retired key the game knows about, whatever they are today — the
    // suite asks "does a bump drop what came before", not "does it drop v3".
    // Written from BALANCE.oldSaveKeys so a bump needs no edit here.
    BALANCE.oldSaveKeys.forEach((k, i) => localStorage.setItem(k, mk('bio', 2 + i, 2 + i)));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(()=>typeof window.startGame==='function');
  const after = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
    slots: slotNumbers().map(n => slotData(n) ? 'FILLED' : 'empty'),
    loadDisabled: document.getElementById('continue-btn').disabled
  }));
  ok('retired keys purged', after.keys.length === 0, JSON.stringify(after.keys));
  ok('both slots empty', after.slots.every(s => s === 'empty'), after.slots.join(','));
  ok('LOAD GAME disabled', after.loadDisabled);
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  ok('NEW GAME goes straight to the intro, no picker',
     await page.evaluate(()=>document.querySelector('.screen.active')?.id)==='intro-screen');
  await page.click('#intro-screen .btn-evolve');
  await page.click('.class-card.bio');
  await page.click('#start-btn');
  await page.click('#skip-btn');
  await page.waitForFunction(()=>state.player&&state.combatActive);
  await page.evaluate(()=>{ state.wave = 5; saveRun(); });
  const keys = await page.evaluate(()=>Object.keys(localStorage).sort());
  const live = await page.evaluate(()=>slotKey(1));
  const retired = await page.evaluate(()=>BALANCE.oldSaveKeys);
  ok('writes to the current slot key', keys.includes(live), JSON.stringify(keys));
  ok('does not resurrect a retired key', !keys.some(k=>retired.includes(k)), JSON.stringify(keys));
  await page.click('.sidebar-tab[data-tab="menu"]'); await page.click('#tab-menu .btn-ghost');
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:nth-child(1) .save-slot-body');
  await page.waitForFunction(()=>state.player&&state.combatActive);
  ok('the new save loads back', await page.evaluate(()=>state.wave)===5 && await page.evaluate(()=>state.player.class)==='bio');
  await page.evaluate(()=>{ state.wave = 9; saveRun(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(()=>typeof window.startGame==='function');
  ok('a new save survives a reload', await page.evaluate(()=>slotData(1)?.wave)===9,
     String(await page.evaluate(()=>slotData(1)?.wave)));
}
