// Crawl every local page, verify each link/asset resolves, and collect JS errors.
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

const PAGES = [
  '/', '/marketing', '/marketing-en', '/prints', '/produse', '/produs',
  '/servicii', '/consultanta', '/faq', '/oferta', '/contact', '/contact-en',
  '/despre-noi', '/despre-noi-en', '/cos', '/checkout', '/succes',
  '/termeni-si-conditii', '/politica-confidentialitate', '/politica-cookies',
  '/404.html', '/robots.txt', '/sitemap.xml',
];

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();

const linkCache = new Map();
async function check(url) {
  if (linkCache.has(url)) return linkCache.get(url);
  let status;
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual' });
    status = r.status;
  } catch (e) {
    status = 'ERR ' + e.message;
  }
  linkCache.set(url, status);
  return status;
}

const problems = [];
const external = new Set();

for (const path of PAGES) {
  const errors = [];
  const failedReq = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.removeAllListeners('requestfailed');
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.startsWith(BASE)) failedReq.push(`${r.failure()?.errorText} ${u}`);
  });

  let res;
  try {
    res = await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 45000 });
  } catch (e) {
    problems.push(`${path}  NAVIGATION FAILED: ${e.message}`);
    continue;
  }

  const status = res.status();
  const expected = path === '/404.html' ? 404 : 200;
  if (status !== expected) problems.push(`${path}  HTTP ${status} (expected ${expected})`);

  if (path.endsWith('.txt') || path.endsWith('.xml')) continue;

  // Collect every href/src on the page.
  const refs = await page.evaluate(() =>
    [...document.querySelectorAll('[href],[src],source[srcset]')]
      .map((el) => ({
        url: el.getAttribute('href') || el.getAttribute('src') || el.getAttribute('srcset'),
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 40),
      }))
      .filter((r) => r.url && !r.url.startsWith('#') && !r.url.startsWith('mailto:')
                     && !r.url.startsWith('tel:') && !r.url.startsWith('data:')
                     && !r.url.startsWith('javascript:'))
  );

  for (const { url, tag, text } of refs) {
    // A srcset holds several candidates, each with a width/density descriptor.
    const candidates = url.includes(',') && /\s+\d+[wx]\s*(,|$)/.test(url)
      ? url.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean)
      : [url];
    for (const cand of candidates) {
      if (/^https?:\/\//.test(cand)) { external.add(cand.split('?')[0]); continue; }
      const abs = new URL(cand, BASE + path).href;
      const st = await check(abs);
      if (st !== 200) problems.push(`${path}  <${tag}> "${text}" -> ${cand}  => ${st}`);
    }
  }

  if (errors.length) problems.push(`${path}  JS: ${[...new Set(errors)].join(' | ')}`);
  if (failedReq.length) problems.push(`${path}  REQ: ${[...new Set(failedReq)].join(' | ')}`);
}

await browser.close();

console.log('\n=== INTERNAL PROBLEMS (' + problems.length + ') ===');
console.log(problems.length ? problems.join('\n') : 'none');
console.log('\n=== EXTERNAL URLS REFERENCED (' + external.size + ') ===');
console.log([...external].sort().join('\n'));
