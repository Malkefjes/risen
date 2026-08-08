export default async function ({ page, ok }) {
  await page.evaluate(() => {
    localStorage.clear(); startGame(true, 'bio');

    gainXP(state.player.xpNext);
  });
  await page.waitForTimeout(500);

  const read = () => page.evaluate(() => {
    const parse = t => parseInt(String(t || '').replace(/,/g, ''), 10);
    return {
      hp: Math.floor(state.player.hp),
      maxHp: Math.floor(state.player.maxHp),
      card: parse((document.querySelector('#player-slot .bar-text') || {}).textContent),
      sidebar: parse((document.getElementById('d-hp') || {}).textContent),
      wave: state.wave
    };
  });

  let cardStale = 0, sidebarStale = 0, damaged = 0, samples = 0;
  const seen = [];
  const maxSeen = new Set();
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => {

      if (state.atCamp) {
        if (nextDrop()) resolveDrop(false);
        else if (nextModOffer()) takeMod(botTakesMod(nextModOffer()));
        else if (state.hazardOffer) pickHazard(state.hazardOffer[0]);
        else moveOut();
        return;
      }
      const p = state.player;
      if (p.points > 0) { adjustStat('vit', 1); return; }
      if (pendingTotal(p) > 0) commitStats();
    });
    await page.waitForTimeout(420);
    const s = await read();
    samples++;
    seen.push(`${s.hp}/${s.maxHp}|card ${s.card}|tile ${s.sidebar}`);
    if (s.card !== s.hp) cardStale++;
    if (s.sidebar !== s.maxHp) sidebarStale++;
    if (s.hp < s.maxHp) damaged++;
    maxSeen.add(s.maxHp);
  }

  ok('the player actually took damage during the sample',
     damaged > 0, `${damaged}/${samples} samples below full HP`);
  ok('max HP actually moved during the sample',
     maxSeen.size > 1, `saw ${[...maxSeen].join(', ')}`);
  ok('the fighter card shows current HP off the sheet',
     cardStale === 0, `${cardStale}/${samples} stale — ${seen.join('  ')}`);
  ok('the sidebar HEALTH tile shows max HP off the sheet',
     sidebarStale === 0, `${sidebarStale}/${samples} stale — ${seen.join('  ')}`);
}
