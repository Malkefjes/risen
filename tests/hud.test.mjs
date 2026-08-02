// THE SCREEN MUST NOT DISAGREE WITH THE SHEET.
//
// The HP number lives in two places at once, and they answer DIFFERENT
// QUESTIONS: the bar above the fighter is what you have right now, and the
// sidebar's HEALTH tile is the ceiling — a sheet number sitting beside attack
// damage and turn rate (see the note above the `hp` row in readouts()). They
// are drawn by different code on different schedules — the card by
// updateUnitCard on every exchange, the tile by refreshReadoutValues — and when
// the sidebar was only reachable through updateHud (a level, a spawn, an
// allocation) it sat frozen at whatever it read when the wave began.
//
// So each readout is held against the sheet number it claims to show. This
// suite used to hold BOTH against current HP, which was right when the tile
// read "122 / 160" and went stale the moment it became the ceiling alone — it
// failed for a change that was deliberate, which is the failure mode a seam
// test has to avoid to stay worth reading.
//
// It is deliberately about AGREEMENT rather than any particular number, so it
// keeps holding when the numbers move. Both halves are guarded against passing
// vacuously: the bar means nothing if the player never got hit, and the tile
// means nothing if max HP never moved, so the run has to produce both.
export default async function ({ page, ok }) {
  await page.evaluate(() => {
    localStorage.clear(); startGame(true, 'bio'); SETTINGS.fastTurns = true;
    // A level is handed over rather than earned, through the game's own gainXP.
    // Waiting for one costs about a minute of real turns and then arrives or
    // does not depending on the dice — and the tile guard below is vacuous
    // until max HP moves, so the run would sometimes prove nothing and say it
    // passed. The points land in the pool and the loop spends them on Vitality
    // in its first two samples, which is what moves the ceiling.
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

  // Enough exchanges to cross a wave boundary and a level-up, since those are
  // the beats that used to mask the bug by refreshing the sidebar for free.
  let cardStale = 0, sidebarStale = 0, damaged = 0, samples = 0;
  const seen = [];
  const maxSeen = new Set();
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
    seen.push(`${s.hp}/${s.maxHp}|card ${s.card}|tile ${s.sidebar}`);
    if (s.card !== s.hp) cardStale++;
    if (s.sidebar !== s.maxHp) sidebarStale++;
    if (s.hp < s.maxHp) damaged++;
    maxSeen.add(s.maxHp);
  }

  // Each guard only means something if the run actually moved the number it
  // watches — a sample that never dropped below full, or never bought a point
  // of Vitality, would pass a frozen readout too. Allocating vit is what moves
  // max HP, and the loop above does it on the first points it is handed.
  ok('the player actually took damage during the sample',
     damaged > 0, `${damaged}/${samples} samples below full HP`);
  ok('max HP actually moved during the sample',
     maxSeen.size > 1, `saw ${[...maxSeen].join(', ')}`);
  ok('the fighter card shows current HP off the sheet',
     cardStale === 0, `${cardStale}/${samples} stale — ${seen.join('  ')}`);
  ok('the sidebar HEALTH tile shows max HP off the sheet',
     sidebarStale === 0, `${sidebarStale}/${samples} stale — ${seen.join('  ')}`);
}
