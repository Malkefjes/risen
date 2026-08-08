export default async function ({ page, ok }) {

  await page.evaluate(() => { localStorage.clear(); startGame(true, 'bio'); });
  await page.waitForFunction(() => state.player && state.combatActive);
  await page.evaluate(() => {
    const q = document.getElementById('camp-panel'); if (q) q.classList.add('on');
    const cm = document.getElementById('combo-meter'); if (cm) cm.style.display = 'block';
  });

  const fresh = await page.evaluate(() => {
    goToMenu(); startGame(true, 'psy');
    const p = state.player;
    return { wave: state.wave, level: p.level, cls: p.class, full: p.hp === p.maxHp };
  });
  await page.waitForFunction(() => state.player && state.combatActive);
  await page.waitForTimeout(400);

  const s = await page.evaluate(() => {
    const lit = sel => [...document.querySelectorAll(sel)].every(e => getComputedStyle(e).opacity !== '0');
    const shown = sel => [...document.querySelectorAll(sel)].every(e => getComputedStyle(e).visibility !== 'hidden');
    return {
      leftovers: [
        (document.getElementById('camp-panel') || {}).classList?.contains('on') && 'an open camp panel',
        (document.getElementById('combo-meter') || {}).style?.display === 'block' && 'the combo meter'
      ].filter(Boolean),
      fighters: document.querySelectorAll('#arena-card .fighter').length,
      playable: lit('.arena-side') && shown('.skills') && shown('.turn-info')
    };
  });

  ok('the new run kept nothing from the old one', s.leftovers.length === 0, s.leftovers.join(', '));
  ok('it is a first wave, not a resumed one',
     fresh.wave === 1 && fresh.level === 1 && fresh.full && fresh.cls === 'psy',
     `wave ${fresh.wave} · level ${fresh.level} · ${fresh.cls}${fresh.full ? '' : ' · not at full HP'}`);
  ok('both fighters are on the card', s.fighters === 2, String(s.fighters));
  ok('the controls came back', s.playable);

  const art = await page.evaluate(async () => {
    const urls = new Set();
    const walk = v => {
      if (typeof v === 'string') { if (v.startsWith('assets/')) urls.add(v); }
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    [ZONE_SPRITES, POSE_SPRITES, PLAYER_SPRITES, SLOTS, CAMP_SPRITES].forEach(walk);
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
