export default async function ({ page, ok }) {

  await page.evaluate(() => { localStorage.clear(); startGame(true, 'bio'); SETTINGS.fastTurns = true; });
  await page.waitForFunction(() => state.player && state.combatActive);
  await page.evaluate(() => openScene('scientist', () => {}));
  await page.waitForFunction(() => !document.getElementById('scene-panel').hidden, null, { timeout: 15000 });

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

  const art = await page.evaluate(async () => {
    const urls = new Set();
    const walk = v => {
      if (typeof v === 'string') { if (v.startsWith('assets/')) urls.add(v); }
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    [ZONE_SPRITES, POSE_SPRITES, PLAYER_SPRITES, SCIENTIST_SPRITES, SCENES, SLOTS].forEach(walk);
    const cssText = [...document.styleSheets]
      .flatMap(sh => { try { return [...sh.cssRules].map(r => r.cssText); } catch { return []; } }).join('\n');

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
