// Refinements are removed as a concept, and drafting still works without them.
//
// The second half matters more than the first: with the pool empty it is easy
// to delete the filler tier and not notice you also broke drafting. So this
// registers two real mutations, proves a draft offers exactly two rather than
// padding to three, and picking one applies its effect.
export default async function ({ page, ctx, ok }) {
  const g = await page.evaluate(() => ({
    refGlobal: typeof window.REFINEMENTS,
    refIdent: (() => { try { REFINEMENTS; return 'exists'; } catch(e){ return e.constructor.name; } })(),
    talents: typeof TALENTS,
    find: [typeof findTalentDef, findTalentDef('ref_dmg'), findTalentDef('atrophy')]
  }));
  ok('REFINEMENTS gone from the code', g.refGlobal==='undefined' && g.refIdent==='ReferenceError', JSON.stringify(g));
  ok('TALENTS registry still present', g.talents==='object');
  ok('findTalentDef still works, returns null for old ids', g.find[0]==='function' && g.find[1]===null);

  // Drafting still works when TALENTS has content — prove the system is alive.
  const live = await page.evaluate(() => {
    TALENTS.testA = { id:'testA', name:'Test A', tag:'Test', power:0.5,
                      desc:'+{power%} damage.', apply(pp){ pp.dmgMult *= 1 + this.power; } };
    TALENTS.testB = { id:'testB', name:'Test B', tag:'Test', power:0.25,
                      desc:'+{power%} max HP.', apply(pp){ pp.hpMult *= 1 + this.power; } };
    state.player = freshPlayer('bio'); recalcPlayerStats();
    const rolled = rollTalentOffers(state.player).map(t => t.id);
    const queued = queueTalentOffer(5);
    refreshTalentUI();
    const before = state.player.dmgMult;
    pickTalent('testA');
    const res = { rolled, queued, before, after: state.player.dmgMult,
                  ids: state.player.talentIds.slice(),
                  card: document.getElementById('talent-list').textContent.replace(/\s+/g,' ').trim().slice(0,60) };
    delete TALENTS.testA; delete TALENTS.testB;
    return res;
  });
  ok('draft offers only real mutations (2, not padded to 3)', live.rolled.length===2, JSON.stringify(live.rolled));
  ok('offer is created when content exists', live.queued===true);
  ok('picking applies the effect', live.after > live.before, live.before+' -> '+live.after);
  ok('picked id is recorded', live.ids.includes('testA'), JSON.stringify(live.ids));
  ok('owned list renders the real name', live.card.includes('Test A'), live.card);

  // And with the registry empty again, nothing drafts.
  const empty = await page.evaluate(() => {
    state.player = freshPlayer('sym'); recalcPlayerStats();
    return { rolled: rollTalentOffers(state.player).length, queued: queueTalentOffer(5),
             tab: (refreshTalentUI(), document.getElementById('talent-list').textContent.trim()) };
  });
  ok('empty registry -> no picks', empty.rolled===0);
  ok('empty registry -> no offer', empty.queued===false);
  ok('empty state message correct', empty.tab==='No mutations in the pool yet', JSON.stringify(empty.tab));
}
