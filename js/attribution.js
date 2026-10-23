/* ============================================================
   CoreForm — Lead source attribution
   ------------------------------------------------------------
   Load right after consent.js:  <script src="js/attribution.js?v=1" defer></script>

   Remembers where the visitor came from (utm_* tags, Google/Meta
   ad clicks, the referring site) so the lead forms can send it
   with the lead (leads-capture.js → leads.attribution).

   • last touch  — this visit only, sessionStorage (no cookie,
                   cleared when the tab closes). Always on.
   • first touch — the first visit, localStorage for 90 days.
                   Only with analytics consent (consent.js);
                   deleted again when consent is withdrawn.

   No personal data: click IDs are stored as true/false, the
   referrer as a host name only.
   ============================================================ */
(function () {
  'use strict';

  var LAST_KEY = 'cf-attr-last';
  var FIRST_KEY = 'cf-attr-first';
  var FIRST_DAYS = 90;
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  function storage(name) {
    try { return window[name]; } catch (e) { return null; }
  }
  function read(store, key) {
    try { var raw = store && store.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function write(store, key, value) {
    try { if (store) store.setItem(key, JSON.stringify(value)); } catch (e) { /* full / blocked */ }
  }
  function remove(store, key) {
    try { if (store) store.removeItem(key); } catch (e) { /* blocked */ }
  }

  var session = storage('sessionStorage');
  var local = storage('localStorage');

  function bareHost(host) { return String(host || '').toLowerCase().replace(/^www\./, ''); }

  function currentTouch() {
    var params = new URLSearchParams(location.search);
    var touch = {};
    UTM.forEach(function (key) {
      var value = params.get(key);
      if (value) touch[key] = value.slice(0, 150);
    });
    if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) touch.gclid = true;
    if (params.has('fbclid')) touch.fbclid = true;
    try {
      var ref = bareHost(new URL(document.referrer).hostname);
      if (ref && ref !== bareHost(location.hostname)) touch.referrer = ref.slice(0, 150);
    } catch (e) { /* no referrer */ }
    touch.landing = location.pathname.slice(0, 150);
    touch.at = new Date().toISOString();
    return touch;
  }

  function isCampaign(touch) {
    return !!(touch && (touch.utm_source || touch.utm_medium || touch.utm_campaign || touch.gclid || touch.fbclid));
  }

  // ── Last touch (this visit) ──
  // Internal navigation keeps it; a new campaign click (or an outside
  // referrer after an untagged start) replaces it.
  var touch = currentTouch();
  var last = read(session, LAST_KEY);
  if (!last || isCampaign(touch) || (touch.referrer && !isCampaign(last))) {
    last = touch;
    write(session, LAST_KEY, last);
  }

  // ── First touch (90 days, consent only) ──
  function hasConsent() {
    return !!(window.CoreFormConsent && window.CoreFormConsent.get() === true);
  }

  function readFirst() {
    var saved = read(local, FIRST_KEY);
    if (saved && saved.exp > Date.now() && saved.touch) return saved.touch;
    if (saved) remove(local, FIRST_KEY);
    return null;
  }

  function rememberFirst() {
    if (!readFirst() && last) {
      write(local, FIRST_KEY, { touch: last, exp: Date.now() + FIRST_DAYS * 864e5 });
    }
  }

  if (hasConsent()) rememberFirst();

  document.addEventListener('coreform:consent', function (e) {
    if (e.detail && e.detail.analytics) rememberFirst();
    else remove(local, FIRST_KEY);
  });

  window.cfAttribution = {
    get: function () {
      var first = hasConsent() ? readFirst() : null;
      if (!first && !last) return null;
      return { first: first, last: last };
    }
  };
})();
