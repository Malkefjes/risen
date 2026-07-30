// THE SCREEN MUST NOT DISAGREE WITH THE SHEET.
//
// The HP number lives in two places at once: the bar above the fighter and the
// Health row in the stats sidebar. They are drawn by different code on
// different schedules — the card by updateUnitCard on every exchange, the
// sidebar by refreshSidebarStats — and when the sidebar was only reachable
// through updateHud (a level, a spawn, an allocation) it sat frozen at
// whatever it read when the wave began. The bar said 58/100 while the sidebar,
// which looks the more authoritative of the two, still said 100/100.
//
// This suite plays real turns through real clicks and requires the two to
// agree after every one. It is deliberately about AGREEMENT rather than any
// particular number: it reads whatever the rules say the player's HP is and
// demands both readouts match it, so it keeps holding when the numbers move.
export default async function ({ page, ok }) {
  await page.evaluate(() => { localStorage.clear(); startGame(true, 'bio'); SETTINGS.fastTurns = true; });
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

  // Enough exchanges to cross a wave boundary and a level-up, since those are
  // the beats that used to mask the bug by refreshing the sidebar for free.
  let cardStale = 0, sidebarStale = 0, damaged = 0, samples = 0;
  const seen = [];
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => {
      if (!state.awaitingInput || !state.combatActive) return;
      const p = state.player;
      if (p.points > 0) { adjustStat('vit', 1); return; }
      if (pendingTotal(p) > 0) { commitStats(); return; }
      playerAct(p.skills.find(s => s.basic) || p.skills[0]);
    });
    await page.waitForTimeout(420);
    const s = await read();
    samples++;
    seen.push(`${s.hp}|card ${s.card}|side ${s.sidebar}`);
    if (s.card !== s.hp) cardStale++;
    if (s.sidebar !== s.hp) sidebarStale++;
    if (s.hp < s.maxHp) damaged++;
  }

  // The guard only means something if the player actually took hits — a run
  // that never dropped below full would pass a broken build too.
  ok('the player actually took damage during the sample',
     damaged > 0, `${damaged}/${samples} samples below full HP`);
  ok('the fighter card HP matches the sheet',
     cardStale === 0, `${cardStale}/${samples} stale — ${seen.join('  ')}`);
  ok('the sidebar Health row matches the sheet',
     sidebarStale === 0, `${sidebarStale}/${samples} stale — ${seen.join('  ')}`);
}
