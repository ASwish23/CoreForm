/* ============================================================
   CoreForm — Cookie consent + Google Analytics 4 (Consent Mode v2)
   ------------------------------------------------------------
   Drop `<script src="consent.js" defer></script>` into any page.
   Self-contained: injects its own styles, banner and preferences
   dialog. No dependencies.

   >>> SETUP: replace GA_MEASUREMENT_ID with your real GA4 ID
   >>> (Google Analytics -> Admin -> Data Streams -> "G-XXXXXXXXXX").
   >>> Until it is replaced, analytics stays off and a one-line
   >>> notice is logged to the console. Everything else works.

   Privacy posture: gtag.js is NOT downloaded until the visitor
   grants analytics consent, so no Google cookie or network call
   happens beforehand. Consent Mode v2 signals are still sent so a
   later grant/withdrawal is honoured without a page reload.
   ============================================================ */
(function () {
  'use strict';

  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';   // <-- replace me
  var COOKIE_NAME = 'coreform_consent';
  var COOKIE_DAYS = 180;                     // 6 months, per the cookie policy
  var VERSION = 1;                           // bump to re-ask everyone

  /* ── Cookie helpers ─────────────────────────────────── */
  function readConsent() {
    var match = document.cookie.match(/(?:^|;\s*)coreform_consent=([^;]*)/);
    if (!match) return null;
    try {
      var parsed = JSON.parse(decodeURIComponent(match[1]));
      if (parsed && parsed.v === VERSION) return parsed;
    } catch (e) { /* malformed cookie -> ask again */ }
    return null;
  }

  function writeConsent(analytics) {
    var payload = encodeURIComponent(JSON.stringify({
      v: VERSION,
      analytics: !!analytics,
      ts: new Date().toISOString()
    }));
    var expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = COOKIE_NAME + '=' + payload +
      '; Path=/; Expires=' + expires + '; SameSite=Lax' + secure;
  }

  /* Remove GA cookies when consent is withdrawn. */
  function clearAnalyticsCookies() {
    var host = location.hostname;
    var domains = ['', '; Domain=' + host, '; Domain=.' + host.replace(/^www\./, '')];
    document.cookie.split(';').forEach(function (raw) {
      var name = raw.split('=')[0].trim();
      if (!/^_ga/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT' + d;
      });
    });
  }

  /* ── Google Consent Mode v2 ─────────────────────────── */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Defaults must be registered before any measurement call.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  var gaLoaded = false;
  function loadAnalytics() {
    if (gaLoaded) return;
    if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID) || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
      console.info('[CoreForm] Consent granted, but GA_MEASUREMENT_ID is not set in consent.js — analytics not loaded.');
      return;
    }
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function applyConsent(analytics) {
    gtag('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    if (analytics) {
      loadAnalytics();
    } else {
      clearAnalyticsCookies();
    }
    document.dispatchEvent(new CustomEvent('coreform:consent', { detail: { analytics: analytics } }));
  }

  /* ── Styles ─────────────────────────────────────────── */
  var CSS = [
    '.cf-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '.cf-consent,.cf-consent *{box-sizing:border-box}',
    '.cf-consent{position:fixed;z-index:9998;left:1rem;right:1rem;bottom:1rem;max-width:33rem;',
      'background:#33553F;color:#FADADA;border:1px solid rgba(250,218,218,.16);border-radius:16px;',
      'padding:1.25rem;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:.9375rem;line-height:1.65;',
      'box-shadow:0 2px 4px rgba(14,30,22,.3),0 20px 52px -12px rgba(14,30,22,.6),0 0 0 1px rgba(250,218,218,.07);',
      'opacity:0;transform:translateY(14px);transition:opacity 260ms cubic-bezier(.34,1.4,.64,1),transform 260ms cubic-bezier(.34,1.4,.64,1)}',
    '.cf-consent.is-in{opacity:1;transform:translateY(0)}',
    '.cf-consent h2{font-family:"Playfair Display",Georgia,serif;font-size:1.125rem;line-height:1.25;letter-spacing:-.02em;margin:0 0 .4rem;color:#FADADA}',
    '.cf-consent p{margin:0 0 1rem;color:rgba(250,218,218,.88)}',
    '.cf-consent a{color:#FADADA;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(250,218,218,.45)}',
    '.cf-consent a:hover{text-decoration-color:#FADADA}',
    '.cf-actions{display:flex;flex-wrap:wrap;gap:.6rem}',
    '.cf-btn{flex:1 1 auto;min-width:8.5rem;padding:.7rem 1.1rem;border-radius:999px;border:1px solid #FADADA;',
      'font:inherit;font-weight:600;font-size:.875rem;cursor:pointer;background:transparent;color:#FADADA;',
      'will-change:transform;transition:transform 200ms cubic-bezier(.34,1.4,.64,1),box-shadow 200ms cubic-bezier(.34,1.4,.64,1),background-color 200ms ease}',
    '.cf-btn-primary{background:#FADADA;color:#2C4A3B}',
    '.cf-btn-link{flex:0 0 auto;min-width:0;border-color:transparent;text-decoration:underline;text-underline-offset:3px}',
    '.cf-btn:hover{transform:translateY(-2px);box-shadow:0 10px 24px -8px rgba(14,30,22,.7)}',
    '.cf-btn:active{transform:translateY(0) scale(.985)}',
    '.cf-btn:focus-visible{outline:2px solid #FADADA;outline-offset:3px}',
    '.cf-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(10,22,16,.68);backdrop-filter:blur(3px);',
      'display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity 200ms ease}',
    '.cf-backdrop.is-in{opacity:1}',
    '.cf-modal{width:100%;max-width:33rem;max-height:86vh;overflow-y:auto;background:#33553F;color:#FADADA;',
      'border:1px solid rgba(250,218,218,.16);border-radius:18px;padding:1.5rem;',
      'font-family:Inter,system-ui,-apple-system,sans-serif;font-size:.9375rem;line-height:1.65;',
      'box-shadow:0 2px 4px rgba(14,30,22,.3),0 28px 64px -14px rgba(14,30,22,.7)}',
    '.cf-modal h2{font-family:"Playfair Display",Georgia,serif;font-size:1.375rem;letter-spacing:-.02em;margin:0 0 .5rem;color:#FADADA}',
    '.cf-modal > p{margin:0 0 1.25rem;color:rgba(250,218,218,.88)}',
    '.cf-group{background:#3B6049;border:1px solid rgba(250,218,218,.14);border-radius:12px;padding:1rem;margin-bottom:.75rem}',
    '.cf-group-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}',
    '.cf-group-title{font-weight:600}',
    '.cf-group p{margin:.35rem 0 0;font-size:.8125rem;color:rgba(250,218,218,.75)}',
    '.cf-locked{font-size:.75rem;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:rgba(250,218,218,.6);white-space:nowrap;padding-top:.2rem}',
    '.cf-switch{position:relative;flex:0 0 auto;width:2.9rem;height:1.6rem}',
    '.cf-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.cf-track{position:absolute;inset:0;border-radius:999px;background:rgba(14,30,22,.55);border:1px solid rgba(250,218,218,.28);',
      'transition:background-color 200ms ease,border-color 200ms ease;pointer-events:none}',
    '.cf-thumb{position:absolute;top:.22rem;left:.24rem;width:1.05rem;height:1.05rem;border-radius:50%;background:#FADADA;',
      'transition:transform 200ms cubic-bezier(.34,1.4,.64,1);pointer-events:none}',
    '.cf-switch input:checked ~ .cf-track{background:rgba(250,218,218,.35);border-color:#FADADA}',
    '.cf-switch input:checked ~ .cf-thumb{transform:translateX(1.28rem)}',
    '.cf-switch input:focus-visible ~ .cf-track{outline:2px solid #FADADA;outline-offset:3px}',
    '.cf-modal .cf-actions{margin-top:1.25rem}',
    /* Footer trigger button, styled to sit inside .footer-links */
    '.footer-cookie-btn{background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer;',
      'text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(250,218,218,.4);',
      'opacity:.75;transition:opacity 200ms ease}',
    '.footer-cookie-btn:hover{opacity:1;text-decoration-color:currentColor}',
    '.footer-cookie-btn:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:3px;opacity:1}',
    '@media (max-width:520px){.cf-consent{left:.75rem;right:.75rem;bottom:.75rem;padding:1.1rem}',
      '.cf-btn{flex:1 1 100%}.cf-btn-link{flex:1 1 100%}}',
    '@media (prefers-reduced-motion:reduce){.cf-consent,.cf-btn,.cf-backdrop,.cf-thumb,.cf-track{transition:none}',
      '.cf-btn:hover{transform:none}}'
  ].join('');

  function injectStyles() {
    if (document.getElementById('cf-consent-styles')) return;
    var style = document.createElement('style');
    style.id = 'cf-consent-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ── Focus management ───────────────────────────────── */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var lastFocused = null;

  function trapFocus(container, event) {
    var items = Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (el) { return el.offsetParent !== null || el.type === 'checkbox'; }
    );
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  /* ── Banner ─────────────────────────────────────────── */
  var banner = null;

  function closeBanner() {
    if (!banner) return;
    var el = banner;
    banner = null;
    el.classList.remove('is-in');
    setTimeout(function () { el.remove(); }, 260);
  }

  function showBanner() {
    if (banner || document.querySelector('.cf-consent')) return;
    injectStyles();
    banner = document.createElement('div');
    banner.className = 'cf-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'cf-consent-title');
    banner.setAttribute('aria-describedby', 'cf-consent-desc');
    banner.innerHTML =
      '<h2 id="cf-consent-title">Cookie-uri pe coreform.ro</h2>' +
      '<p id="cf-consent-desc">Folosim cookie-uri strict necesare pentru funcționarea site-ului. ' +
      'Cu acordul tău, adăugăm și cookie-uri de analiză, ca să vedem ce pagini sunt utile. ' +
      'Detalii în <a href="/politica-cookies.html">Politica de Cookie-uri</a>.</p>' +
      '<div class="cf-actions">' +
        '<button type="button" class="cf-btn cf-btn-primary" data-cf="accept">Acceptă tot</button>' +
        '<button type="button" class="cf-btn" data-cf="reject">Doar necesare</button>' +
        '<button type="button" class="cf-btn cf-btn-link" data-cf="customise">Personalizează</button>' +
      '</div>';
    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('is-in'); });

    banner.addEventListener('click', function (e) {
      var action = e.target.getAttribute && e.target.getAttribute('data-cf');
      if (action === 'accept') { writeConsent(true); applyConsent(true); closeBanner(); }
      else if (action === 'reject') { writeConsent(false); applyConsent(false); closeBanner(); }
      else if (action === 'customise') { closeBanner(); openModal(); }
    });
  }

  /* ── Preferences dialog ─────────────────────────────── */
  function openModal() {
    injectStyles();
    if (document.querySelector('.cf-backdrop')) return;
    lastFocused = document.activeElement;
    var saved = readConsent();

    var backdrop = document.createElement('div');
    backdrop.className = 'cf-backdrop';
    backdrop.innerHTML =
      '<div class="cf-modal" role="dialog" aria-modal="true" aria-labelledby="cf-modal-title">' +
        '<h2 id="cf-modal-title">Setări cookie-uri</h2>' +
        '<p>Alege ce categorii accepți. Poți reveni oricând asupra deciziei.</p>' +
        '<div class="cf-group">' +
          '<div class="cf-group-head">' +
            '<span class="cf-group-title">Strict necesare</span>' +
            '<span class="cf-locked">Mereu active</span>' +
          '</div>' +
          '<p>Fac posibile navigarea, coșul de cumpărături și securitatea plății. Fără ele site-ul nu funcționează.</p>' +
        '</div>' +
        '<div class="cf-group">' +
          '<div class="cf-group-head">' +
            '<label class="cf-group-title" for="cf-analytics">Analiză (Google Analytics 4)</label>' +
            '<span class="cf-switch">' +
              '<input type="checkbox" id="cf-analytics"' + (saved && saved.analytics ? ' checked' : '') + '>' +
              '<span class="cf-track"></span><span class="cf-thumb"></span>' +
            '</span>' +
          '</div>' +
          '<p>Statistici anonime despre paginile vizitate, ca să îmbunătățim site-ul. IP anonimizat, fără publicitate.</p>' +
        '</div>' +
        '<div class="cf-actions">' +
          '<button type="button" class="cf-btn cf-btn-primary" data-cf="save">Salvează opțiunile</button>' +
          '<button type="button" class="cf-btn" data-cf="accept-all">Acceptă tot</button>' +
          '<button type="button" class="cf-btn cf-btn-link" data-cf="close">Închide</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(backdrop);
    requestAnimationFrame(function () { backdrop.classList.add('is-in'); });

    var modal = backdrop.querySelector('.cf-modal');
    var toggle = backdrop.querySelector('#cf-analytics');
    modal.querySelector('[data-cf="save"]').focus();

    function close() {
      backdrop.classList.remove('is-in');
      document.removeEventListener('keydown', onKeydown, true);
      setTimeout(function () { backdrop.remove(); }, 200);
      if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { trapFocus(modal, e); }
    }
    document.addEventListener('keydown', onKeydown, true);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) { close(); return; }
      var action = e.target.getAttribute && e.target.getAttribute('data-cf');
      if (action === 'save') {
        writeConsent(toggle.checked); applyConsent(toggle.checked); close();
      } else if (action === 'accept-all') {
        toggle.checked = true; writeConsent(true); applyConsent(true); close();
      } else if (action === 'close') {
        close();
      }
    });
  }

  /* ── Boot ───────────────────────────────────────────── */
  function init() {
    injectStyles();

    // Any element with [data-cookie-settings] reopens the dialog.
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest && e.target.closest('[data-cookie-settings]');
      if (trigger) { e.preventDefault(); openModal(); }
    });

    var saved = readConsent();
    if (saved) {
      applyConsent(saved.analytics);
    } else {
      showBanner();
    }
  }

  // Expose a tiny API for other scripts / manual testing.
  window.CoreFormConsent = {
    open: openModal,
    get: function () { var c = readConsent(); return c ? c.analytics : null; },
    reset: function () {
      document.cookie = COOKIE_NAME + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT';
      clearAnalyticsCookies();
      location.reload();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
