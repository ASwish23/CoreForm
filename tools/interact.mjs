// Functional tests: mobile nav, cookie consent flow, contrast of key text.
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
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });

const ok = (b) => (b ? 'PASS' : 'FAIL');

// ══ 1. Mobile nav ══════════════════════════════════════════
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const path of ['/prints', '/faq', '/produse', '/produs', '/servicii', '/consultanta',
                      '/oferta', '/cos', '/checkout', '/politica-cookies',
                      '/politica-confidentialitate', '/termeni-si-conditii', '/404.html',
                      '/marketing', '/despre-noi', '/contact']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle2' });
    const r = await page.evaluate(() => {
      const t = document.getElementById('navToggle') || document.getElementById('hamburger');
      const l = document.getElementById('navLinks');
      if (!t || !l) return { missing: true };
      const visible = getComputedStyle(t).display !== 'none';
      const before = l.getBoundingClientRect().height;
      t.click();
      return new Promise((res) =>
        setTimeout(() => res({
          visible,
          before: Math.round(before),
          after: Math.round(l.getBoundingClientRect().height),
          expanded: t.getAttribute('aria-expanded'),
          activeClass: t.classList.contains('active'),
        }), 550));
    });
    if (r.missing) { console.log(`  ${path.padEnd(26)} no nav toggle on page`); continue; }
    const opened = r.after > r.before + 40;
    console.log(`  ${path.padEnd(26)} toggle visible=${ok(r.visible)}  opens=${ok(opened)} (${r.before}->${r.after}px)  aria-expanded=${r.expanded}`);
  }
  await page.close();
}

// ══ 2. Cookie consent flow ═════════════════════════════════
console.log('\n── Cookie consent ──');
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // First visit: banner shows, no GA cookie, no Google request.
  const googleHits = [];
  page.on('request', (r) => { if (r.url().includes('googletagmanager')) googleHits.push(r.url()); });
  await page.goto(BASE + '/faq', { waitUntil: 'networkidle2' });
  const bannerShown = await page.$('.cf-consent') !== null;
  console.log('  banner on first visit          ' + ok(bannerShown));
  console.log('  no gtag before consent         ' + ok(googleHits.length === 0));

  // "Personalizează" opens the dialog.
  await page.click('[data-cf="customise"]');
  await new Promise((r) => setTimeout(r, 400));
  const modal = await page.evaluate(() => {
    const m = document.querySelector('.cf-modal');
    return m ? { open: true, modalAttr: m.getAttribute('aria-modal'),
                 focused: document.activeElement?.getAttribute('data-cf') } : { open: false };
  });
  console.log('  "Personalizează" opens dialog  ' + ok(modal.open) + `  aria-modal=${modal.modalAttr} focus=${modal.focused}`);

  // Escape closes it.
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 350));
  console.log('  Escape closes dialog           ' + ok(await page.$('.cf-backdrop') === null));

  // Reject -> cookie written as analytics:false.
  await page.reload({ waitUntil: 'networkidle2' });
  await page.click('[data-cf="reject"]');
  await new Promise((r) => setTimeout(r, 400));
  let c = (await page.cookies()).find((x) => x.name === 'coreform_consent');
  console.log('  "Doar necesare" stores refusal ' + ok(c && decodeURIComponent(c.value).includes('"analytics":false')));

  // Preference persists across a reload (banner must not reappear).
  await page.reload({ waitUntil: 'networkidle2' });
  console.log('  preference persists            ' + ok(await page.$('.cf-consent') === null));

  // Footer trigger reopens the dialog.
  await page.evaluate(() => document.querySelector('[data-cookie-settings]')?.click());
  await new Promise((r) => setTimeout(r, 400));
  console.log('  footer button reopens dialog   ' + ok(await page.$('.cf-modal') !== null));

  // Accept all -> cookie flips to true.
  await page.click('[data-cf="accept-all"]');
  await new Promise((r) => setTimeout(r, 400));
  c = (await page.cookies()).find((x) => x.name === 'coreform_consent');
  console.log('  "Acceptă tot" stores consent   ' + ok(c && decodeURIComponent(c.value).includes('"analytics":true')));
  await page.close();
}

// ══ 3. Contrast of key text against its background ═════════
console.log('\n── Contrast (WCAG AA needs 4.5:1 body / 3:1 large) ──');
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  for (const path of ['/faq', '/prints', '/oferta', '/politica-confidentialitate', '/404.html', '/marketing']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle2' });
    const rows = await page.evaluate(() => {
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const alphaOf = (s) => {
        const m = s.match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/);
        return m ? Number(m[1]) : 1;
      };
      // Composite every translucent layer down to the first opaque one.
      const bgOf = (el) => {
        const stack = [];
        let n = el;
        while (n && n !== document.documentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          const a = alphaOf(bg);
          if (a > 0) {
            stack.push({ rgb: parse(bg), a });
            if (a >= 1) break;
          }
          n = n.parentElement;
        }
        let base = [255, 255, 255];
        const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
        if (alphaOf(htmlBg) >= 1) base = parse(htmlBg);
        // paint from the bottom layer upwards
        let out = base;
        for (let i = stack.length - 1; i >= 0; i--) {
          const { rgb, a } = stack[i];
          out = rgb.map((v, j) => v * a + out[j] * (1 - a));
        }
        return out;
      };
      const out = [];
      const seen = new Set();
      const sel = 'p, li, a, h1, h2, h3, .btn, .cta-button, .legal-btn, .package-cta, td, th, label, .footer-copy, .footer-links a';
      for (const el of document.querySelectorAll(sel)) {
        const txt = (el.textContent || '').trim();
        if (!txt || txt.length < 4) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue; // gradient text
        const fg = parse(cs.color);
        const alpha = (cs.color.match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/) || [])[1];
        const bg = bgOf(el);
        // flatten a translucent foreground onto its background
        const a = alpha === undefined ? 1 : Number(alpha);
        const eff = fg.map((v, i) => v * a + bg[i] * (1 - a));
        const L1 = lum(eff), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        const need = large ? 3 : 4.5;
        if (ratio < need) {
          const key = el.tagName + txt.slice(0, 24);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ txt: txt.replace(/\s+/g, ' ').slice(0, 44), ratio: ratio.toFixed(2), need, size: Math.round(size), cls: el.className.toString().slice(0, 28) });
        }
      }
      return out.slice(0, 8);
    });
    if (rows.length) {
      console.log('  ' + path);
      rows.forEach((r) => console.log(`     ${r.ratio.padStart(5)}:1 (need ${r.need})  ${r.size}px  "${r.txt}"  .${r.cls}`));
    } else {
      console.log('  ' + path.padEnd(30) + ' no contrast failures found');
    }
  }
  await page.close();
}

await browser.close();
