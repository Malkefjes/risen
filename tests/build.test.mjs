// The build stamp must reach all three places it claims to, and must not be
// derived from BALANCE.saveKey — coupling them would wipe saves on a typo fix.
export default async function ({ page, ctx, ok }) {
  const v = await page.evaluate(()=>BUILD);
  console.log('build version:', v, '\n');
  ok('title screen shows the version', await page.textContent('#build-tag') === v,
     await page.textContent('#build-tag'));
  ok('version is not derived from saveKey',
     await page.evaluate(()=>!BALANCE.saveKey.includes(BUILD)));

  await page.evaluate(()=>localStorage.clear());
  // BY LABEL, NOT BY POSITION. This used to be `.menu-stack .btn:nth-child(1)`
  // and broke the moment the title screen was restyled — the suite could no
  // longer start a run, which reads as a save-format failure rather than as a
  // renamed class. What the test means is "press NEW GAME", so that is what it
  // asks for.
  await page.click('#title-screen button:has-text("NEW GAME")');
  await page.click('#intro-screen .btn-evolve');
  await page.click('.class-card.sym');
  await page.click('#start-btn');
  await page.click('#skip-btn');
  await page.waitForFunction(()=>state.player&&state.combatActive);
  const first = await page.evaluate(()=>document.querySelector('#combat-log .log-entry')?.textContent);
  ok('combat log opens with the build line', first === 'RISEN · build '+v, first);

  await page.evaluate(()=>{ state.wave=4; saveRun(); });
  ok('the save records the build', await page.evaluate(()=>slotData(1)?.build) === v,
     String(await page.evaluate(()=>slotData(1)?.build)));

  // Resuming must re-stamp, not inherit the saved build.
  await page.click('.sidebar-tab[data-tab="menu"]'); await page.click('#tab-menu .btn-ghost');
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:nth-child(1) .save-slot-body');
  await page.waitForFunction(()=>state.player&&state.combatActive);
  const firstResumed = await page.evaluate(()=>document.querySelector('#combat-log .log-entry')?.textContent);
  ok('a resumed run also opens with the build line', firstResumed.startsWith('RISEN · build '+v), firstResumed);
}
