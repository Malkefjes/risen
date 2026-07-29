// Dump one run's combat log. The fastest way to see whether a mechanic does
// what its numbers claim — the log is a transcript, so it should be possible to
// reconstruct the fight from it alone.
//
//   node tools/transcript.mjs [bio|psy|sym|base]
import { serve, launch } from '../tests/harness.mjs';

const CLS = process.argv[2] || 'bio';
const server = await serve();
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.startGame === 'function');

const r = await page.evaluate((CLS) => simulateRun(CLS, { keepLog: true }), CLS);
if (!r) { console.error('unknown strain: ' + CLS); process.exit(1); }
console.log(r.log.join('\n'));
console.log(`\n-- ${r.won ? 'WON' : 'died on wave ' + r.wave} at level ${r.level}` +
            ` after ${r.kills} kills, ${r.damageDealt} damage dealt`);
await browser.close(); await server.close();
