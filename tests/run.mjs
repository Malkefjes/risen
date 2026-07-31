// Runs every suite against a freshly served copy of the game.
//
//   npm test              all suites
//   npm test -- strain    only suites whose name contains "strain"
//
// Each suite gets its own browser context, so one suite's saves can never
// leak into another's.
import { serve, launch, tracker, openGame } from './harness.mjs';

const SUITES = [
  ['saves',        'run state resets between runs; two save slots'],
  ['strain',       'strain select cannot start the wrong class'],
  ['saveversion',  'save version bump purges older saves'],
  ['mutations',    'mutation system works with an empty pool'],
  ['refinements',  'refinements are gone and drafting still works'],
  ['build',        'build stamp reaches the title, log and save'],
  ['hud',          'the screen never disagrees with the sheet'],
  ['instinct',     'Instinct buys crit chance and damage, and reaches Strength'],
  ['thorns',       'sym grows one number, and it is the only thing it spends'],
  ['playability',  'the first boss is a check, not a wall'],
  ['headless',     'headless mode runs the same game, with no side effects']
];

const filter = process.argv[2];
const picked = SUITES.filter(([n]) => !filter || n.includes(filter));
if (!picked.length) { console.error('no suite matches ' + filter); process.exit(1); }

const server = await serve();
const browser = await launch();
let totalPass = 0, totalFail = 0;
const failedSuites = [];

for (const [name, blurb] of picked) {
  const mod = await import(`./${name}.test.mjs`);
  const { ctx, page, errors } = await openGame(browser, server.url);
  const t = tracker();
  let crash = null;
  try {
    await mod.default({ page, ctx, ok: t.ok, url: server.url });
  } catch (e) {
    crash = e;
  }
  // Asserted for every suite rather than remembered per suite: a page error is
  // a failure no matter which behaviour was under test when it happened.
  t.ok('no JS errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  if (crash) t.ok('suite ran to completion', false, String(crash).split('\n')[0]);
  await ctx.close();

  const pass = t.rows.filter(r => r.pass).length;
  const fail = t.rows.length - pass;
  totalPass += pass; totalFail += fail;
  if (fail) failedSuites.push(name);

  console.log(`\n${fail ? '✗' : '✓'} ${name}  —  ${blurb}`);
  for (const r of t.rows) {
    if (r.pass) console.log(`    ·  ${r.label}`);
    else console.log(`   FAIL ${r.label}${r.detail ? '  -> ' + r.detail : ''}`);
  }
  console.log(`    ${pass} passed${fail ? ', ' + fail + ' FAILED' : ''}`);
}

await browser.close();
await server.close();

console.log('\n' + '─'.repeat(60));
console.log(`${totalPass} passed, ${totalFail} failed` +
            (failedSuites.length ? `   (${failedSuites.join(', ')})` : ''));
process.exit(totalFail ? 1 : 0);
