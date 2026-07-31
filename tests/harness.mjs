// Shared plumbing for the test suites. Two jobs: serve the game, and give each
// suite a page plus an assertion function.
//
// The static server is hand-rolled rather than pulled from npm so the suite has
// exactly one dependency (playwright). The game is a single file with no build
// step; its tests should not need a toolchain either.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const REPO = resolve(fileURLToPath(new URL('../', import.meta.url)));

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2',
               '.json':'application/json' };

// file:// would be closer to how the game is actually played, but browsers
// restrict localStorage there and every suite here exercises saves.
export async function serve() {
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const path = join(REPO, rel);
    // Refuse anything that climbs out of the repo. A localhost test server,
    // but there is no reason to write the sloppy version.
    if (!path.startsWith(REPO + sep)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream',
                           'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { url: `http://127.0.0.1:${port}/index.html`,
           close: () => new Promise(r => server.close(r)) };
}

export async function launch() {
  // No executablePath by default: let playwright resolve its own browser, so
  // this runs on any machine with `npx playwright install chromium` rather
  // than only where someone hardcoded a path. RISEN_CHROMIUM overrides it for
  // environments that ship a browser at a known path instead.
  const exe = process.env.RISEN_CHROMIUM;
  return chromium.launch(exe ? { executablePath: exe } : {});
}

// One suite's results, and there are TWO KINDS OF ROW because there are two
// kinds of thing a suite can find out.
//
//   ok(label, cond)     A CHECK. Something is either wired up or broken:
//                       the wound ticks, the save purges, a spoiled charge
//                       lands between an ordinary hit and a full one. Facts
//                       about whether the machine works. These can fail.
//
//   say(label, value)   A MEASUREMENT. A number the game currently produces:
//                       a clear rate, a share of a bar, where two curves
//                       cross. It is printed and NEVER fails.
//
// THE SPLIT EXISTS BECAUSE A THRESHOLD IS A DESIGN DECISION IN DISGUISE, and
// this suite is not where design decisions get made. A test demanding "base
// clears the first boss 50% of the time" reads like rigour and behaves like a
// gate: the number moves, something goes red, and whoever is holding the
// keyboard edits the game — or edits the threshold — before the owner has
// seen the number at all. The measurement never arrives; a verdict arrives
// instead, already acted on. That is backwards. Changes happen, numbers get
// reported, and the person who plays the game decides what they mean.
//
// The test for whether something belongs in `ok`: if it failed, would you
// have found a BUG, or would you have found out the game changed? Bugs go in
// ok. Everything else says its number and shuts up.
export function tracker() {
  const rows = [];
  return {
    rows,
    ok(label, cond, detail = '') { rows.push({ label, pass: !!cond, detail: String(detail) }); },
    say(label, value) { rows.push({ label, measure: true, value: String(value) }); }
  };
}

// Every suite starts from a clean page: fresh context (so localStorage is
// empty), game loaded, JS errors captured. Network noise is ignored — the
// Google Fonts @import fails in a sandbox and says nothing about the game.
export async function openGame(browser, url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.startGame === 'function');
  return { ctx, page, errors };
}
