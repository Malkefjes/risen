// How far does each stat-allocation strategy get, per strain?
//
// Answers "is this stat a build or a garnish" — the question that drove the
// Speed rework. An all-SPEED column that dies where all-VIT wins means Speed
// is not competing; the two landing close means it is.
import { serve, launch } from '../tests/harness.mjs';

const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const RUNS = Number(process.argv[2] || 5);
const out = await page.evaluate(async (RUNS) => {
  window.scheduleTurn = (fn) => { if (state.turnTimer) clearTimeout(state.turnTimer);
    state.turnTimer = setTimeout(() => { state.turnTimer = null; fn(); }, 0); };
  const sleep = () => new Promise(r => setTimeout(r, 0));

  async function play(cls, plan) {
    localStorage.clear(); goToMenu(); startGame(true, cls); SETTINGS.fastTurns = true;
    let g = 0, i = 0;
    while (g++ < 60000) {
      if (document.getElementById('result-screen').classList.contains('active')) break;
      if (state.player?.points > 0) adjustStat(plan[i++ % plan.length], 1);
      if (state.player?.points <= 0 && pendingTotal(state.player) > 0) commitStats();
      if (state.talentOffers?.picks?.length) pickTalent(state.talentOffers.picks[0].id);
      if (state.awaitingInput && state.combatActive) {
        const u = state.player.skills.filter(s => !s.basic && s.cd <= 0
          && !(s.requiresCharges && (state.player.charges || 0) < s.requiresCharges));
        playerAct(u.length ? u[0] : state.player.skills[0]);
      }
      await sleep();
    }
    return { wave: state.wave, won: document.getElementById('result-title').textContent === 'RISEN' };
  }
  const PLANS = { 'all STR':['str'], 'all INS':['instinct'], 'all SPD':['speed'],
                  'all VIT':['vit'], 'balanced':['str','instinct','speed','vit'] };
  const res = {};
  for (const [name, plan] of Object.entries(PLANS)) {
    res[name] = {};
    for (const cls of ['bio','psy','sym','base']) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await play(cls, plan));
      runs.sort((a, b) => a.wave - b.wave);
      res[name][cls] = { med: runs[Math.floor(runs.length/2)].wave, wins: runs.filter(r => r.won).length };
    }
  }
  return res;
}, RUNS);

console.log(`\n${RUNS} runs per cell.  "median wave reached / wins"\n`);
console.log('allocation   ' + ['bio','psy','sym','base'].map(c => c.padEnd(12)).join(''));
for (const [name, byCls] of Object.entries(out))
  console.log(name.padEnd(13) + ['bio','psy','sym','base']
    .map(c => `${byCls[c].med}w ${byCls[c].wins}/${RUNS}`.padEnd(12)).join(''));
await browser.close(); await server.close();
