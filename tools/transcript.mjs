// Dump one run's combat log. The fastest way to see whether a mechanic is
// doing what its numbers claim — the log is a transcript, so it should be
// possible to reconstruct the fight from it alone.
//
//   node tools/transcript.mjs [bio|psy|sym|base] [turns]
import { serve, launch } from '../tests/harness.mjs';

const CLS = process.argv[2] || 'bio';
const STEPS = Number(process.argv[3] || 200);
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const lines = await page.evaluate(async ({ CLS, STEPS }) => {
  window.scheduleTurn = (fn) => { if (state.turnTimer) clearTimeout(state.turnTimer);
    state.turnTimer = setTimeout(() => { state.turnTimer = null; fn(); }, 0); };
  localStorage.clear(); goToMenu(); startGame(true, CLS); SETTINGS.fastTurns = true;
  for (let i = 0; i < STEPS * 40; i++) {
    if (document.getElementById('result-screen').classList.contains('active')) break;
    if (state.player?.points > 0) adjustStat(['str','vit','instinct','speed'][state.player.level % 4], 1);
    if (state.player?.points <= 0 && pendingTotal(state.player) > 0) commitStats();
    if (state.awaitingInput && state.combatActive) {
      const u = state.player.skills.filter(s => !s.basic && s.cd <= 0
        && !(s.requiresCharges && (state.player.charges || 0) < s.requiresCharges));
      playerAct(u.length ? u[0] : state.player.skills[0]);
    }
    await new Promise(r => setTimeout(r, 0));
  }
  return Array.from(document.querySelectorAll('#combat-log .log-entry')).map(e => {
    const cls = e.className;
    const indent = /\bev\b|\bspec\b/.test(cls) ? '    ' : '';
    return indent + e.textContent;
  });
}, { CLS, STEPS });

console.log(lines.join('\n'));
console.log(`\n(${lines.length} lines — the log keeps the most recent ${400})`);
await browser.close(); await server.close();
