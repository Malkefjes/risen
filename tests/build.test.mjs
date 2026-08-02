// The build stamp must reach both places it claims to — the title screen and
// the save — and must not be derived from BALANCE.saveKey, since coupling them
// would wipe saves on a typo fix. It used to have a third place, the first line
// of the on-screen combat log; that log is an instrument now and no longer
// drawn, so the resume check below reads the save instead.
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
  await page.click('#intro-screen button:has-text("MUTATE")');
  await page.click('.class-card.sym');
  await page.click('#start-btn');
  // EVOLVE plays a transition beat before the run. SKIP jumps to a playable
  // fight; tolerate it being gone already.
  await page.locator('#skip-btn').click({ timeout: 2000 }).catch(() => {});
  await page.waitForFunction(()=>state.player&&state.combatActive, null, { timeout: 20000 });
  await page.evaluate(()=>{ state.wave=4; saveRun(); });
  ok('the save records the build', await page.evaluate(()=>slotData(1)?.build) === v,
     String(await page.evaluate(()=>slotData(1)?.build)));

  // Resuming must RE-STAMP, not inherit. Backdating the stored stamp is what
  // makes the difference visible: if the next save carries 'ancient-build'
  // forward, serializeRun is copying what it loaded instead of writing BUILD.
  await page.evaluate(()=>{
    const d = JSON.parse(localStorage.getItem(slotKey(1)));
    d.build = 'ancient-build';
    localStorage.setItem(slotKey(1), JSON.stringify(d));
  });
  await page.click('.sidebar-tab[data-tab="menu"]'); await page.click('#tab-menu .ui-btn.is-quiet');
  await page.click('#continue-btn');
  await page.click('#save-list .save-slot:nth-child(1) .save-slot-body');
  await page.waitForFunction(()=>state.player&&state.combatActive);
  await page.evaluate(()=>saveRun());
  const resaved = await page.evaluate(()=>slotData(1)?.build);
  ok('a resumed run re-stamps the build rather than inheriting it', resaved === v, String(resaved));
}
