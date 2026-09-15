// Screenshot helper for the CoreForm site.
//   node screenshot.mjs http://localhost:3000            -> temporary screenshots/screenshot-N.png
//   node screenshot.mjs http://localhost:3000 label      -> temporary screenshots/screenshot-N-label.png
//   node screenshot.mjs http://localhost:3000 label 390  -> render at 390px wide (mobile)
import puppeteer from 'puppeteer-core';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const [url, label = '', widthArg] = process.argv.slice(2);
if (!url) {
  console.error('usage: node screenshot.mjs <url> [label] [width]');
  process.exit(1);
}
if (url.startsWith('file://')) {
  console.error('Refusing to screenshot a file:// URL — start `node serve.mjs` and use http://localhost:3000');
  process.exit(1);
}

const width = Number(widthArg) || 1440;
const OUT = join(process.cwd(), 'temporary screenshots');
mkdirSync(OUT, { recursive: true });

// Auto-increment so earlier screenshots are never overwritten.
const used = readdirSync(OUT)
  .map((f) => /^screenshot-(\d+)/.exec(f))
  .filter(Boolean)
  .map((m) => Number(m[1]));
const n = used.length ? Math.max(...used) + 1 : 1;
const file = join(OUT, `screenshot-${n}${label ? `-${label}` : ''}.png`);

// Locate the Chrome that puppeteer already downloaded for this user.
const cacheRoot = join(homedir(), '.cache', 'puppeteer', 'chrome');
if (!existsSync(cacheRoot)) {
  console.error(`No Chrome found at ${cacheRoot}. Run: npx puppeteer browsers install chrome`);
  process.exit(1);
}
const build = readdirSync(cacheRoot).sort().pop();
const executablePath = join(cacheRoot, build, 'chrome-win64', 'chrome.exe');

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));
const failed = [];
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));

const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
// Let scroll-triggered (AOS) animations settle before capturing.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 900));
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise((r) => setTimeout(r, 400));

await page.screenshot({ path: file, fullPage: true });
await browser.close();

console.log(`HTTP ${response?.status()}  ${width}px  ->  ${file}`);
if (consoleErrors.length) console.log('console errors:\n  ' + consoleErrors.join('\n  '));
if (failed.length) console.log('failed requests:\n  ' + failed.join('\n  '));
