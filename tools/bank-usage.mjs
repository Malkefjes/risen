// Can each strain's resource bank actually fill?
//
// This is the instrument that found psy: Momentum is +1 per landed hit and -2
// per hit taken, so at the 1:1 turn anchor every exchange is net -1 and the
// bank drains. Three of psy's four skills are gated behind it, so they never
// fire — "not paid" counts how often that happened.
import { serve, launch } from '../tests/harness.mjs';

const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const RUNS = Number(process.argv[2] || 3);
const out = await page.evaluate(async (RUNS) => {
  window.scheduleTurn = (fn) => { if (state.turnTimer) clearTimeout(state.turnTimer);
    state.turnTimer = setTimeout(() => { state.turnTimer = null; fn(); }, 0); };
  const sleep = () => new Promise(r => setTimeout(r, 0));

  async function play(cls) {
    localStorage.clear(); goToMenu(); startGame(true, cls); SETTINGS.fastTurns = true;
    const bank = bankOf(cls);
    let g = 0, peak = 0, sum = 0, samples = 0, notPaid = 0;
    const realLog = window.log;
    window.log = (m, t) => { if (/not paid/.test(m)) notPaid++; realLog(m, t); };
    while (g++ < 40000) {
      if (document.getElementById('result-screen').classList.contains('active')) break;
      if (state.player?.points > 0) adjustStat(['str','vit','instinct','speed'][state.player.level % 4], 1);
      if (state.player?.points <= 0 && pendingTotal(state.player) > 0) commitStats();
      if (state.awaitingInput && state.combatActive) {
        const cur = bank ? (state.player[bank.field] || 0) : 0;
        peak = Math.max(peak, cur); sum += cur; samples++;
        const affordable = state.player.skills.filter(s => !s.basic && s.cd <= 0
          && !(s.requiresCharges && cur < s.requiresCharges));
        playerAct(affordable[0] || state.player.skills[0]);
      }
      await sleep();
    }
    window.log = realLog;
    return { cap: bank ? bank.cap : 0, peak, avg: sum / Math.max(1, samples),
             notPaid, wave: state.wave };
  }
  const res = {};
  for (const c of ['bio','psy','sym','base']) {
    res[c] = [];
    for (let i = 0; i < RUNS; i++) res[c].push(await play(c));
  }
  return res;
}, RUNS);

console.log(`\n${RUNS} runs per strain.  "not paid" = a gated skill fired with an empty bank.\n`);
console.log('strain   cap   peak held   avg held   not paid   wave reached');
for (const [cls, runs] of Object.entries(out)) {
  const f = k => (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(1);
  console.log(cls.padEnd(8), String(runs[0].cap).padStart(3), f('peak').padStart(10),
    f('avg').padStart(11), f('notPaid').padStart(10), f('wave').padStart(13));
}
await browser.close(); await server.close();
