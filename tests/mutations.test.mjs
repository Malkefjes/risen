// The mutation system must keep working while its content pool is empty.
//
// An empty pool is the live configuration, not an edge case: levels pass with
// no draft, and the tab says so. Also guards the crash an empty pool used to
// cause, and that a save carrying ids from an older build still loads.
export default async function ({ page, ctx, ok }) {
  const api = await page.evaluate(() => ({
    talents: Object.keys(TALENTS).length,
    fns: ['rollTalentOffers','pickTalent','queueTalentOffer','promoteQueuedTalent',
          'refreshTalentUI','findTalentDef','addBasicRider'].map(f => typeof window[f]),
    rider: typeof window.addBasicRider
  }));
  ok('TALENTS empty', api.talents === 0, String(api.talents));
  ok('every mutation function still defined', api.fns.every(t => t === 'function'), api.fns.join(','));
  const draft = await page.evaluate(() => {
    state.player = freshPlayer('bio'); recalcPlayerStats();
    const rolled = rollTalentOffers(state.player);          // the old infinite-loop path
    const queued = queueTalentOffer(5);
    promoteQueuedTalent();
    return { rolled: rolled.length, queued, offers: state.talentOffers, queue: state.talentQueue.length };
  });
  ok('rollTalentOffers returns []', draft.rolled === 0, String(draft.rolled));
  ok('queueTalentOffer declines', draft.queued === false, String(draft.queued));
  ok('no offer created', draft.offers === null, JSON.stringify(draft.offers));
  ok('nothing queued', draft.queue === 0, String(draft.queue));
  const run = await page.evaluate(async () => {
    window.scheduleTurn = (fn) => { if (state.turnTimer) clearTimeout(state.turnTimer);
      state.turnTimer = setTimeout(() => { state.turnTimer = null; fn(); }, 0); };
    localStorage.clear(); goToMenu(); startGame(true, 'sym'); SETTINGS.fastTurns=true;
    let g=0, sawOffer=false;
    while (g++ < 60000) {
      if (document.getElementById('result-screen').classList.contains('active')) break;
      if (state.talentOffers) sawOffer = true;
      if (state.player?.points > 0) adjustStat('vit', 1);
      if (state.player?.points <= 0 && pendingTotal(state.player) > 0) commitStats();
      if (state.awaitingInput && state.combatActive) {
        const u = state.player.skills.filter(s => !s.basic && s.cd <= 0);
        playerAct(u.length ? u[0] : state.player.skills[0]);
      }
      await new Promise(r => setTimeout(r, 0));
    }
    switchTab('talents');
    return { level: state.player.level, sawOffer, ids: state.player.talentIds.length,
             tabText: document.getElementById('talent-list').textContent.trim(),
             won: document.getElementById('result-title').textContent === 'RISEN' };
  });
  ok('run reached the mutation levels', run.level >= 10, 'level ' + run.level);
  ok('no draft was ever offered', run.sawOffer === false);
  ok('no mutations acquired', run.ids === 0, String(run.ids));
  ok('tab shows the honest empty state', run.tabText === 'No mutations in the pool yet', JSON.stringify(run.tabText));
  const legacy = await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('risen_run_v4_s1', JSON.stringify({
      v:2, classId:'bio', wave:6, kills:5, bestCombo:2, talentQueue:[],
      player:{ level:6, xp:0, xpNext:200, points:0, str:9, instinct:5, speed:7, vit:8,
               dmgMult:1.32, hpMult:1.25, apsMult:1.11, hp:120, maxHp:160,
               talents:{ critFlat:0.07 }, talentIds:['atrophy','ref_dmg','ref_dmg'],
               statuses:[], skillCds:[0,0,0,0] } }));
    refreshContinueButton(); continueRun(1); switchTab('talents');
    return { cls: state.player.class, wave: state.wave, ids: state.player.talentIds.length,
             dmgMult: state.player.dmgMult, atk: attackDamage(state.player),
             tab: document.getElementById('talent-list').textContent.replace(/\s+/g,' ').trim().slice(0,80) };
  });
  ok('legacy save loads', legacy.cls === 'bio' && legacy.wave === 6, JSON.stringify(legacy));
  ok('its earned multipliers survive', legacy.dmgMult === 1.32, String(legacy.dmgMult));
  ok('its mutation ids are kept', legacy.ids === 3, String(legacy.ids));
  ok('unknown ids render as legacy, not a crash', legacy.tab.includes('Legacy mutation'), legacy.tab);
}
