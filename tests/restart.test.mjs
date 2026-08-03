// A NEW RUN MUST NOT INHERIT THE LAST ONE, and every declared sprite must load.
//
// Two seams, both invisible while the rules are perfectly correct. Transient UI
// is cleaned up by whoever put it there, so each new feature is a fresh chance
// to leave something standing — the scene after the first boss did exactly
// that, and quitting mid-conversation came up inside the old scene. Art is the
// same shape of problem: a renamed file breaks one class at one level and
// nothing notices until it is played.
export default async function ({ page, ok }) {
  // Leave a run in the messiest state there is: mid-fight, mid-scene.
  await page.evaluate(() => { localStorage.clear(); startGame(true, 'bio'); SETTINGS.fastTurns = true; });
  await page.waitForFunction(() => state.player && state.combatActive);
  await page.evaluate(() => openScene('scientist', () => {}));
  await page.waitForFunction(() => !document.getElementById('scene-panel').hidden, null, { timeout: 15000 });

  // Out through the menu and straight into another run, on another strain.
  await page.evaluate(() => { goToMenu(); startGame(true, 'psy'); });
  await page.waitForFunction(() => state.player && state.combatActive);
  await page.waitForTimeout(400);

  const s = await page.evaluate(() => {
    const vis = el => !!el && !el.hidden;
    const lit = sel => [...document.querySelectorAll(sel)].every(e => getComputedStyle(e).opacity !== '0');
    const shown = sel => [...document.querySelectorAll(sel)].every(e => getComputedStyle(e).visibility !== 'hidden');
    const p = state.player;
    return {
      wave: state.wave, level: p.level, cls: p.class, full: p.hp === p.maxHp,
      leftovers: [
        state.inScene && 'state.inScene',
        vis(document.getElementById('scene-layer')) && 'scene-layer',
        vis(document.getElementById('scene-panel')) && 'scene-panel',
        document.getElementById('combat-screen').classList.contains('scene-on') && 'scene-on',
        document.getElementById('arena-card').classList.contains('scene') && 'the lab backdrop'
      ].filter(Boolean),
      fighters: document.querySelectorAll('#arena-card .fighter').length,
      playable: lit('.arena-side') && shown('.skills') && shown('.turn-info')
    };
  });

  ok('the new run kept nothing from the old one', s.leftovers.length === 0, s.leftovers.join(', '));
  ok('it is a first wave, not a resumed one',
     s.wave === 1 && s.level === 1 && s.full && s.cls === 'psy',
     `wave ${s.wave} · level ${s.level} · ${s.cls}${s.full ? '' : ' · not at full HP'}`);
  ok('both fighters are on the card', s.fighters === 2, String(s.fighters));
  ok('the controls came back', s.playable);

  // ---- art ----
  // Walked off the tables the game itself declares, so a new set is covered by
  // existing here rather than by being listed. Backdrops are read back out of
  // the stylesheet, where the only reference to them lives.
  const art = await page.evaluate(async () => {
    const urls = new Set();
    const walk = v => {
      if (typeof v === 'string') { if (v.startsWith('assets/')) urls.add(v); }
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    [ZONE_SPRITES, POSE_SPRITES, PLAYER_SPRITES, SCIENTIST_SPRITES, SCENES, SLOTS].forEach(walk);
    const cssText = [...document.styleSheets]
      .flatMap(sh => { try { return [...sh.cssRules].map(r => r.cssText); } catch { return []; } }).join('\n');
    // Images only — @font-face lives in the same stylesheet and does not decode.
    for (const m of cssText.matchAll(/url\(["']?([^"')]*assets\/[^"')]+\.(?:png|jpe?g|webp|gif|svg))["']?\)/gi)) {
      urls.add(m[1].replace(/^\.\.\//, ''));
    }
    const bad = [];
    await Promise.all([...urls].map(u => new Promise(done => {
      const im = new Image();
      im.onload = () => { if (!im.naturalWidth) bad.push(u); done(); };
      im.onerror = () => { bad.push(u); done(); };
      im.src = u;
    })));
    return { count: urls.size, bad };
  });
  ok('every declared image was found', art.count > 20, `only ${art.count} — the tables moved`);
  ok('every declared image loads', art.bad.length === 0, art.bad.join(', '));
}
