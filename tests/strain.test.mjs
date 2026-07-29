// A new run must start as the strain you picked.
//
// It once did not: selectClass left #start-btn enabled and a card .selected
// forever, while loading a save rewrote state.classId behind the screen's back.
// The screen showed BIO with EVOLVE lit, and pressing it started Unmutated.
// The trap needed an ordinary strain run earlier in the session to arm it,
// which is why it looked intermittent — so this suite arms it deliberately.
export default async function ({ page, ctx, ok }) {
  const quit=async()=>{await page.click('.sidebar-tab[data-tab="menu"]');await page.click('#tab-menu .btn-ghost');};
  const seeClassScreen=()=>page.evaluate(()=>({
    stateClassId: state.classId,
    selected: document.querySelector('.class-card.selected')?.className.split(' ')[1] ?? null,
    evolveEnabled: !document.getElementById('start-btn').disabled }));
  await page.evaluate(()=>localStorage.clear());
  // 1. a BIO run arms the trap (this is what selectClass used to leave behind)
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  await page.click('#intro-screen .btn-evolve');
  await page.click('.class-card.bio');
  await page.evaluate(()=>window.startGame(true));
  await page.waitForFunction(()=>state.player&&state.combatActive);
  ok('bio run started as bio', await page.evaluate(()=>state.player.class)==='bio');
  await quit();
  // 2. an Unmutated run in the other slot
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  await page.click('#intro-screen .btn-resist');
  await page.click('#skip-btn');
  await page.waitForFunction(()=>state.player&&state.combatActive);
  ok('RESIST still starts Unmutated (skip path)', await page.evaluate(()=>state.player.class)==='base');
  await quit();
  // 3. load the Unmutated save
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:nth-child(2) .save-slot-body');
  await page.waitForFunction(()=>state.player&&state.combatActive);
  ok('loading the base save gives base', await page.evaluate(()=>state.player.class)==='base');
  await quit();
  // 4. NEW GAME -> MUTATE
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  await page.click('#intro-screen .btn-evolve');
  const scr = await seeClassScreen();
  ok('class screen opens with NO card selected', scr.selected===null, JSON.stringify(scr));
  ok('class screen opens with EVOLVE disabled', scr.evolveEnabled===false, JSON.stringify(scr));
  // 5. EVOLVE with nothing chosen must not start anything
  const preEvolve = await page.evaluate(()=>({ screen:document.querySelector('.screen.active')?.id,
    wave:state.wave, combat:state.combatActive }));
  await page.evaluate(()=>window.startGame());
  const postEvolve = await page.evaluate(()=>({ screen:document.querySelector('.screen.active')?.id,
    wave:state.wave, combat:state.combatActive }));
  // state.player is deliberately NOT checked: goToMenu leaves the previous run's
  // object in place and every real start replaces it, so it is not a signal.
  ok('EVOLVE with no choice starts nothing',
     postEvolve.screen==='class-screen' && !postEvolve.combat
     && JSON.stringify(preEvolve)===JSON.stringify(postEvolve), JSON.stringify(postEvolve));
  // 6. now pick bio and go
  await page.click('.class-card.bio');
  await page.click('#start-btn');
  await page.evaluate(()=>revealCombatNow());
  await page.waitForFunction(()=>state.player);
  const got = await page.evaluate(()=>state.player.class);
  ok('>>> picking BIO after a base save starts BIO <<<', got==='bio', 'got ' + got);
  const sep = await page.evaluate(()=>{
    // A loaded run's class must not become the menu's pending choice.
    selectClass('sym');
    const afterSelect = { pending: _pendingClass, stateClassId: state.classId };
    resetRunState('base');                     // what continueRun does
    const afterLoad = { pending: _pendingClass, stateClassId: state.classId };
    return { afterSelect, afterLoad };
  });
  ok('selectClass writes only the pending choice', sep.afterSelect.pending==='sym', JSON.stringify(sep.afterSelect));
  ok('loading a run writes only state.classId', sep.afterLoad.pending==='sym' && sep.afterLoad.stateClassId==='base',
     JSON.stringify(sep.afterLoad));
  await page.evaluate(()=>{ localStorage.clear(); goToMenu(); });
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  await page.click('#intro-screen .btn-evolve');
  await page.click('.class-card.psy');            // leave a stale pending choice behind
  await page.click('#intro-screen .btn-ghost').catch(()=>{});
  await page.evaluate(()=>{ goToMenu(); });
  await page.click('#title-screen .menu-stack .btn:nth-child(1)');
  await page.click('#intro-screen .btn-resist');
  await page.waitForFunction(()=>state.player&&state.player.class,{timeout:20000});
  ok('RESIST full transition starts Unmutated, not the stale pick',
     await page.evaluate(()=>state.player.class)==='base', await page.evaluate(()=>state.player.class));
}
