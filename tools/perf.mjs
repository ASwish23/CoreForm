// Measure transferred bytes, request count and paint timings per page.
import puppeteer from 'puppeteer-core';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Run from the project root regardless of where this is invoked from.
process.chdir(join(fileURLToPath(new URL('.', import.meta.url)), '..'));

const BASE = 'http://localhost:3000';
const root = join(homedir(), '.cache', 'puppeteer', 'chrome');
const exe = join(root, readdirSync(root).sort().pop(), 'chrome-win64', 'chrome.exe');

const PAGES = ['/', '/marketing', '/prints', '/produse', '/despre-noi', '/faq',
               '/oferta', '/contact', '/politica-confidentialitate', '/404.html'];

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
const kb = (n) => (n / 1024).toFixed(0).padStart(6) + ' KB';

console.log('page                     local wt   reqs   img KB   LCP     notes');
console.log('─'.repeat(78));

for (const path of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCacheEnabled(false);

  let total = 0, images = 0, count = 0, external = 0;
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.startsWith(BASE)) { external++; return; }
    count++;
    try {
      const buf = await r.buffer();
      total += buf.length;
      if (/\.(png|jpe?g|webp|svg|gif|ico)(\?|$)/i.test(u)) images += buf.length;
    } catch { /* redirects have no body */ }
  });

  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});

  const timing = await page.evaluate(() => {
    const lcp = performance.getEntriesByType('largest-contentful-paint').pop();
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const imgs = [...document.images].filter((i) => i.naturalWidth);
    // images served much larger than they are displayed
    const oversized = imgs
      .filter((i) => i.naturalWidth > i.clientWidth * 2.2 && i.clientWidth > 0)
      .map((i) => `${i.currentSrc.split('/').pop()} ${i.naturalWidth}px shown at ${Math.round(i.clientWidth)}px`);
    const noDims = imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length;
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: lcp ? Math.round(lcp.startTime) : null,
      oversized: oversized.slice(0, 2),
      noDims,
    };
  });

  const notes = [];
  if (timing.noDims) notes.push(`${timing.noDims} img w/o width+height`);
  if (timing.oversized.length) notes.push(...timing.oversized);

  console.log(
    path.padEnd(24) +
    kb(total) + '  ' + String(count).padStart(4) + '   ' + kb(images).trim().padStart(8) + '   ' +
    String(timing.lcp ?? '-').padStart(5) + 'ms  ' + (notes.join('; ') || 'ok')
  );
  await page.close();
}

await browser.close();
console.log('\n(local weight excludes CDN assets: Google Fonts, AOS, EmailJS, Supabase)');
