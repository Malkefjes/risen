export default async function ({ page, ctx, ok }) {
  const v = await page.evaluate(()=>BUILD);
  console.log('build version:', v, '\n');
  ok('title screen shows the version', await page.textContent('#build-tag') === v,
     await page.textContent('#build-tag'));
  ok('version is not derived from saveKey',
     await page.evaluate(()=>!BALANCE.saveKey.includes(BUILD)));

  await page.evaluate(()=>localStorage.clear());

  await page.click('#title-screen button:has-text("NEW GAME")');
  await page.click('#intro-screen .intro-choice.is-primary');
  await page.click('.class-card.sym');
  await page.click('#start-btn');

  await page.locator('#skip-btn').click({ timeout: 2000 }).catch(() => {});
  await page.waitForFunction(()=>state.player&&state.combatActive, null, { timeout: 20000 });
  await page.evaluate(()=>{ state.wave=4; saveRun(); });
  ok('the save records the build', await page.evaluate(()=>slotData(1)?.build) === v,
     String(await page.evaluate(()=>slotData(1)?.build)));

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
