import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const REPO = resolve(fileURLToPath(new URL('../', import.meta.url)));

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2',
               '.json':'application/json' };

export async function serve() {
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const path = join(REPO, rel);

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

  const exe = process.env.RISEN_CHROMIUM;
  return chromium.launch(exe ? { executablePath: exe } : {});
}

export function tracker() {
  const rows = [];
  return {
    rows,
    ok(label, cond, detail = '') { rows.push({ label, pass: !!cond, detail: String(detail) }); },
    say(label, value) { rows.push({ label, measure: true, value: String(value) }); }
  };
}

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
