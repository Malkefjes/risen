import { serve, launch, tracker, openGame } from './harness.mjs';

const SUITES = [
  ['saveversion',  'a save-format bump drops older saves rather than migrating them'],
  ['build',        'the build stamp reaches the title, log and save'],
  ['hud',          'the screen never disagrees with the sheet'],
  ['headless',     'headless mode runs the same game, with no side effects'],
  ['restart',      'a new run starts clean, and every sprite loads']
];

const filter = process.argv[2];
const picked = SUITES.filter(([n]) => !filter || n.includes(filter));
if (!picked.length) { console.error('no suite matches ' + filter); process.exit(1); }

const server = await serve();
const browser = await launch();
let totalPass = 0, totalFail = 0, totalMeasures = 0;
const failedSuites = [];

for (const [name, blurb] of picked) {
  const mod = await import(`./${name}.test.mjs`);
  const { ctx, page, errors } = await openGame(browser, server.url);
  const t = tracker();
  let crash = null;
  try {
    await mod.default({ page, ctx, ok: t.ok, say: t.say, url: server.url });
  } catch (e) {
    crash = e;
  }

  t.ok('no JS errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  if (crash) t.ok('suite ran to completion', false, String(crash).split('\n')[0]);
  await ctx.close();

  const checks = t.rows.filter(r => !r.measure);
  const measures = t.rows.filter(r => r.measure);
  const pass = checks.filter(r => r.pass).length;
  const fail = checks.length - pass;
  totalPass += pass; totalFail += fail;
  totalMeasures += measures.length;
  if (fail) failedSuites.push(name);

  console.log(`\n${fail ? '✗' : '✓'} ${name}  —  ${blurb}`);
  for (const r of t.rows) {
    if (r.measure) console.log(`    →  ${r.label}:  ${r.value}`);
    else if (r.pass) console.log(`    ·  ${r.label}`);
    else console.log(`   FAIL ${r.label}${r.detail ? '  -> ' + r.detail : ''}`);
  }
  console.log(`    ${pass} passed${fail ? ', ' + fail + ' FAILED' : ''}`
    + (measures.length ? `, ${measures.length} measured` : ''));
}

await browser.close();
await server.close();

console.log('\n' + '─'.repeat(60));
console.log(`${totalPass} passed, ${totalFail} failed` +
            (totalMeasures ? `, ${totalMeasures} measured` : '') +
            (failedSuites.length ? `   (${failedSuites.join(', ')})` : ''));
process.exit(totalFail ? 1 : 0);
