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
               '.png':'image/png', '.json':'application/json' };

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

// One suite's results. `ok` records rather than throws, so a failing assertion
// does not hide the ones after it.
export function tracker() {
  const rows = [];
  return {
    rows,
    ok(label, cond, detail = '') { rows.push({ label, pass: !!cond, detail: String(detail) }); }
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
