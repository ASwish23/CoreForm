// Audit forms (labels, autocomplete, validation) and CTAs across the site.
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

const PAGES = ['/contact', '/contact-en', '/oferta', '/servicii', '/consultanta',
               '/cos', '/checkout', '/', '/marketing', '/prints', '/produse', '/faq', '/despre-noi'];

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});

  const data = await page.evaluate(() => {
    const out = { forms: [], ctas: [], contrastRisk: [] };

    for (const form of document.querySelectorAll('form')) {
      const fields = [];
      for (const el of form.querySelectorAll('input,select,textarea')) {
        if (el.type === 'hidden') continue;
        const id = el.id;
        const labelled =
          (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
          el.closest('label') ||
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby');
        fields.push({
          name: el.name || el.id || el.type,
          type: el.type || el.tagName.toLowerCase(),
          label: !!labelled,
          required: el.required,
          autocomplete: el.getAttribute('autocomplete') || null,
          inputmode: el.getAttribute('inputmode') || null,
        });
      }
      const submit = form.querySelector('[type="submit"],button:not([type])');
      out.forms.push({
        id: form.id || '(no id)',
        novalidate: form.hasAttribute('novalidate'),
        fields,
        submitText: submit ? submit.textContent.trim().slice(0, 40) : null,
        liveRegion: !!form.querySelector('[aria-live],[role="alert"]') ||
                    !!document.querySelector('[aria-live],[role="alert"]'),
      });
    }

    // Anything that looks like a call to action.
    const sel = 'a.cta-button,a.btn,button.btn,a.nav-cta,a.hero-cta,a[class*="cta"],button[class*="cta"],a[class*="btn"]';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      out.ctas.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 46),
        href: el.getAttribute('href'),
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    return out;
  });

  console.log('\n══════ ' + path + ' ══════');
  for (const f of data.forms) {
    console.log(`  FORM #${f.id}  novalidate=${f.novalidate}  submit="${f.submitText}"  liveRegion=${f.liveRegion}`);
    for (const fl of f.fields) {
      const flags = [];
      if (!fl.label) flags.push('NO-LABEL');
      if (!fl.autocomplete && ['text', 'email', 'tel'].includes(fl.type)) flags.push('no-autocomplete');
      if (fl.type === 'tel' && !fl.inputmode) flags.push('no-inputmode');
      console.log(`     - ${fl.name.padEnd(16)} ${fl.type.padEnd(10)} req=${fl.required ? 'y' : 'n'}  ${flags.join(' ') || 'ok'}`);
    }
  }
  const ctas = data.ctas.filter((c) => c.h > 0);
  if (ctas.length) {
    console.log('  CTAs:');
    for (const c of ctas) {
      const flags = [];
      if (c.tag === 'a' && !c.href && !c.disabled) flags.push('LINK-WITHOUT-HREF');
      if (c.h < 44 || c.w < 44) flags.push(`small-tap-target ${c.w}x${c.h}`);
      if (c.disabled) flags.push('disabled');
      console.log(`     - "${c.text}" -> ${c.href || '(none)'}  ${flags.join(' ') || ''}`);
    }
  }
}

await browser.close();
