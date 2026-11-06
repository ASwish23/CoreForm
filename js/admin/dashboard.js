// ════════════════════════════════════════════════════════════════════════
// CoreForm Admin — Dashboard + Mini-CRM
// Auth guard → load leads → overview / Kanban → realtime sync.
// All lead content is untrusted (comes from public forms): render it with
// textContent only, never innerHTML.
// ════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Constants ───────────────────────────────────────────────────────────
  const STATUSES = [
    { id: 'nou',            label: 'Nou' },
    { id: 'contactat',      label: 'Contactat' },
    { id: 'oferta_trimisa', label: 'Ofertă trimisă' },
    { id: 'castigat',       label: 'Câștigat' },
    { id: 'pierdut',        label: 'Pierdut' }
  ];
  const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.id, s.label]));
  const OPEN_STATUSES = ['nou', 'contactat', 'oferta_trimisa'];

  const SOURCES = {
    oferta:         'Formular ofertă',
    servicii:       'Formular servicii',
    personalizeaza: 'Formular marketing',
    whatsapp:       'WhatsApp',
    telefon:        'Telefon',
    altul:          'Altul'
  };
  const SOURCES_SHORT = {
    oferta:         'Ofertă',
    servicii:       'Servicii',
    personalizeaza: 'Marketing',
    whatsapp:       'WhatsApp',
    telefon:        'Telefon',
    altul:          'Altul'
  };
  const MANUAL_SOURCES = ['whatsapp', 'telefon', 'altul'];

  // Marketing channel: derived in the database from leads.attribution
  // (attribution.js on the site), or picked by hand on manual leads.
  const CHANNELS = {
    google_ads:       'Google Ads',
    meta_ads:         'Meta Ads (Facebook / Instagram)',
    cautare_organica: 'Căutare organică',
    social:           'Social media (organic)',
    email:            'Email',
    referral:         'Alt site (link)',
    direct:           'Direct',
    recomandare:      'Recomandare',
    altul:            'Altul'
  };

  const LOST_REASONS = {
    pret:         'Preț',
    termen:       'Termen de livrare',
    fara_raspuns: 'Fără răspuns',
    alt_furnizor: 'A ales alt furnizor',
    altul:        'Altul'
  };

  // Online shop orders (comenzi). Card: Așteaptă plata → Plătită;
  // ramburs starts as Confirmată and is paid on delivery.
  const ORDER_STATUSES = [
    { id: 'in_asteptare', label: 'Așteaptă plata' },
    { id: 'platit',       label: 'Plătită' },
    { id: 'confirmat',    label: 'Confirmată' },
    { id: 'in_productie', label: 'În producție' },
    { id: 'expediat',     label: 'Expediată' },
    { id: 'livrat',       label: 'Livrată' },
    { id: 'anulat',       label: 'Anulată' }
  ];
  const ORDER_STATUS_LABEL = Object.fromEntries(ORDER_STATUSES.map(s => [s.id, s.label]));
  const ORDER_TODO = ['platit', 'confirmat', 'in_productie'];
  const ORDER_FILTERS = [
    { id: 'all',      label: 'Toate',     match: () => true },
    { id: 'unpaid',   label: 'De plată',  match: (o) => o.status === 'in_asteptare' },
    { id: 'todo',     label: 'De făcut',  match: (o) => ORDER_TODO.includes(o.status) },
    { id: 'shipped',  label: 'Expediate', match: (o) => o.status === 'expediat' },
    { id: 'done',     label: 'Livrate',   match: (o) => o.status === 'livrat' },
    { id: 'canceled', label: 'Anulate',   match: (o) => o.status === 'anulat' }
  ];
  const PAYMENT_LABEL = { card: 'Card', ramburs: 'Ramburs' };

  // WhatsApp templates (drawer → WhatsApp menu).
  // {salut} → "Bună, Andrei!" (or "Bună ziua!" when the lead has no person name)
  // {eu}    → the logged-in admin's display name
  const WA_TEMPLATES = [
    { label: 'Prim contact',
      text: '{salut} Sunt {eu} de la CoreForm. Am primit cererea ta și aș vrea să clarificăm câteva detalii, ca să îți putem trimite o ofertă potrivită. Când ți-ar fi comod să vorbim?' },
    { label: 'Follow-up ofertă',
      text: '{salut} Revin în legătură cu oferta CoreForm pe care ți-am trimis-o. Ai apucat să te uiți pe ea? Dacă ai întrebări sau vrei să ajustăm ceva, spune-mi și rezolvăm. {eu}, CoreForm' },
    { label: 'Comanda e gata',
      text: '{salut} Vești bune: comanda ta este gata. Când ți-ar fi comod să o ridici sau să stabilim livrarea? {eu}, CoreForm' },
    { label: 'Mesaj gol', text: '' }
  ];
  // Order drawer → WhatsApp menu. {nr} = order number, {awb} = tracking number
  const ORDER_WA_TEMPLATES = [
    { label: 'Comandă confirmată',
      text: '{salut} Am primit comanda ta CoreForm #{nr} și ne-am apucat de ea. Te anunțăm imediat ce pleacă spre tine. {eu}, CoreForm' },
    { label: 'Comandă expediată', needsAwb: true,
      text: '{salut} Comanda ta CoreForm #{nr} a fost expediată. Numărul AWB este {awb}. Îți mulțumim! {eu}, CoreForm' },
    { label: 'Mesaj gol', text: '' }
  ];

  // ── State ───────────────────────────────────────────────────────────────
  const state = {
    leads: new Map(),          // full list — loaded lazily for the Kanban
    admins: new Map(),         // user_id → display_name (owner picker, history)
    userId: null,
    mine: readPref('cf-leads-mine') === '1', // Kanban filter "Ale mele"
    orders: new Map(),         // comenzi — loaded when the Orders view opens
    ordersLoaded: false,
    ordersRequested: false,
    orderFilter: readPref('cf-orders-filter') || 'all',
    orderDrawerId: null,
    freshOrderIds: new Set(),
    loaded: false,
    leadsRequested: false,
    briefing: null,            // result of get_briefing() — powers Home
    briefingStatus: 'loading', // 'loading' | 'ready' | 'error'
    briefingAt: 0,
    newRange: 'today',         // KPI toggle: 'today' | 'week'
    query: '',
    view: 'overview',
    freshIds: new Set(),
    savingNew: false,
    drawerId: null // null = closed, 'new' = creating, uuid = editing
  };

  function readPref(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writePref(key, value) {
    try { localStorage.setItem(key, value); } catch { /* private mode */ }
  }

  const $ = (id) => document.getElementById(id);
  const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── Supabase ────────────────────────────────────────────────────────────
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    $('boot-text').textContent = 'Configurația Supabase lipsește (config.js).';
    return;
  }
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  // ── DOM helper ──────────────────────────────────────────────────────────
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'className') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : value);
      }
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child);
    }
    return node;
  }

  // ── Formatting ──────────────────────────────────────────────────────────
  const rtf = new Intl.RelativeTimeFormat('ro', { numeric: 'auto' });
  const dateFmt = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function timeAgo(iso) {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);
    if (abs < 60) return 'chiar acum';
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return dateFmt.format(new Date(iso));
  }

  const numFmt = new Intl.NumberFormat('ro-RO');
  const formatLei = (n) => `${numFmt.format(Math.round(Number(n) || 0))} lei`;
  // Exact amounts (orders): 149,50 lei · 120 lei
  const moneyFmt = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatMoney = (n) => {
    const v = Number(n) || 0;
    return `${Number.isInteger(v) ? numFmt.format(v) : moneyFmt.format(v)} lei`;
  };
  const shortDateFmt = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
  const longDayFmt = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'short' });
  const noDots = (s) => s.replace(/\./g, '');

  // Romanian counting: "1 lead", "3 lead-uri", "20 de lead-uri"
  function plural(n, one, many) {
    if (n === 1) return `1 ${one}`;
    const needsDe = n !== 0 && (n % 100 === 0 || n % 100 >= 20);
    return `${numFmt.format(n)} ${needsDe ? 'de ' : ''}${many}`;
  }

  // 'YYYY-MM-DD' → local Date (avoids the UTC shift of new Date('YYYY-MM-DD'))
  function localDay(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Whole days from today (local) to a 'YYYY-MM-DD' date: 0 = today, -2 = two days ago
  function daysUntil(iso) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((localDay(iso) - today) / 86400000);
  }

  // Next-step due chip: "Restant · 2 zile" / "Azi" / "Mâine" / "12 nov"
  function dueChip(iso) {
    const d = daysUntil(iso);
    const text = d < 0 ? `Restant · ${plural(-d, 'zi', 'zile')}` : d === 0 ? 'Azi' : d === 1 ? 'Mâine' : noDots(dayFmt.format(localDay(iso)));
    return el('span', { className: 'chip chip-due' + (d < 0 ? ' is-stale' : d === 0 ? ' is-waiting' : '') }, text);
  }

  function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
  }

  function ownerName(id) {
    return id ? state.admins.get(id) || 'Admin' : null;
  }

  // Company forms put the company in both name and company → show it once
  const showCompany = (lead) => lead.company && lead.company !== lead.name;

  // Romanian numbers: 07xx… → 407xx…; keeps international numbers as-is.
  function waNumber(phone) {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 10 && digits.startsWith('0')) digits = '40' + digits.slice(1);
    return digits.length >= 8 ? digits : null;
  }

  // ── Toasts ──────────────────────────────────────────────────────────────
  // opts.action → sticky toast with a button (stays until clicked)
  function toast(message, type, opts = {}) {
    const dismiss = () => {
      node.classList.add('is-leaving');
      node.addEventListener('animationend', () => node.remove(), { once: true });
    };
    const node = el('div', { className: 'toast' + (type === 'error' ? ' is-error' : '') + (opts.action ? ' is-sticky' : '') },
      message,
      opts.action && el('button', { type: 'button', className: 'toast-action', text: opts.action, onclick: () => { opts.onAction?.(); dismiss(); } }));
    $('toasts').append(node);
    if (!opts.action) setTimeout(dismiss, type === 'error' ? 4000 : 2000);
  }

  // ── Auth guard ──────────────────────────────────────────────────────────
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return location.replace('login.html');

    const { data: admin, error } = await sb
      .from('admins')
      .select('display_name')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('[Admin] Verificarea accesului a eșuat:', error);
      $('boot-text').textContent = 'Nu am putut verifica accesul. Reîncarcă pagina.';
      return;
    }
    if (!admin) {
      await sb.auth.signOut();
      return location.replace('login.html?e=forbidden');
    }

    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') location.replace('login.html?e=logout');
    });

    state.userId = session.user.id;
    state.admins.set(session.user.id, admin.display_name || session.user.email.split('@')[0]);
    setupUser(session.user, admin.display_name);
    loadAdmins();
    if (!canDrag) $('leads-sub').textContent = 'Schimbă statusul direct din fiecare card.';
    $('boot').remove();
    $('app').hidden = false;

    setupTheme();
    fillReportMonths();
    setupConnectivity();
    route();
    subscribeRealtime();
    // Home needs one RPC; the full Kanban list is prefetched once the briefing is up.
    loadBriefing().finally(() => {
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
      idle(ensureLeads);
    });
    checkHealth();
    setInterval(() => { if (!document.hidden) checkHealth(); }, 60 * 1000);
    setupServiceWorker();
    setupInstall();
  }

  function setupUser(user, displayName) {
    const name = displayName || user.email.split('@')[0];
    state.userName = name;
    $('user-name').textContent = name;
    $('user-email').textContent = user.email;

    const h = new Date().getHours();
    const hello = h < 11 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : 'Bună seara';
    $('greeting-text').textContent = `${hello}, ${name}`;
    const today = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    $('greeting-date').textContent = today.charAt(0).toUpperCase() + today.slice(1);
  }

  $('logout-btn').addEventListener('click', async () => {
    $('logout-btn').disabled = true;
    await sb.auth.signOut();
    location.replace('login.html?e=logout');
  });

  // ── Data ────────────────────────────────────────────────────────────────
  // One round trip: KPIs, 14-day series, needs-attention and recent rows.
  async function loadBriefing() {
    const { data, error } = await sb.rpc('get_briefing', { tz: 'Europe/Bucharest' });
    if (error) {
      console.error('[Briefing] Eroare la încărcare:', error);
      if (state.briefing) toast('Nu am putut actualiza briefing-ul.', 'error');
      else state.briefingStatus = 'error';
      render();
      return;
    }
    state.briefing = data;
    state.briefingStatus = 'ready';
    state.briefingAt = Date.now();
    render();
  }

  // Team list for the owner picker, card initials and the history tab
  async function loadAdmins() {
    const { data, error } = await sb.from('admins').select('user_id, display_name');
    if (error) {
      console.error('[Admin] Lista echipei nu s-a încărcat:', error);
      return;
    }
    data.forEach(a => state.admins.set(a.user_id, a.display_name || 'Admin'));
    render();
  }

  let briefingTimer;
  function refreshBriefingSoon() {
    clearTimeout(briefingTimer);
    briefingTimer = setTimeout(loadBriefing, 400);
  }

  function ensureLeads() {
    if (state.leadsRequested) return;
    state.leadsRequested = true;
    loadLeads();
  }

  async function loadLeads() {
    render();
    const { data, error } = await sb.from('leads').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('[Leads] Eroare la încărcare:', error);
      state.leadsRequested = false;
      toast('Nu am putut încărca lead-urile.', 'error');
      return;
    }
    state.leads = new Map(data.map(l => [l.id, l]));
    state.loaded = true;
    render();
  }

  function subscribeRealtime() {
    sb.channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          state.leads.delete(payload.old.id);
        } else {
          const isNew = !state.leads.has(payload.new.id);
          if (state.loaded) state.leads.set(payload.new.id, payload.new);
          if (isNew && payload.eventType === 'INSERT') {
            state.freshIds.add(payload.new.id);
            if (!state.savingNew) toast(`Lead nou: ${payload.new.name}`);
          }
        }
        render();
        refreshBriefingSoon();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_activity' }, (payload) => {
        addHistoryEntry(payload.new);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comenzi' }, onOrderChange)
      .subscribe((status) => {
        $('live-indicator').classList.toggle('is-off', status !== 'SUBSCRIBED');
        health.realtime = status;
        renderHealth();
      });
  }

  function findLead(id) {
    return state.leads.get(id)
      || state.briefing?.recent?.find(l => l.id === id)
      || state.briefing?.attention?.find(l => l.id === id);
  }

  function sortedLeads() {
    return [...state.leads.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  function matches(lead) {
    if (state.mine && lead.owner_id !== state.userId) return false;
    if (!state.query) return true;
    const hay = [lead.name, lead.company, lead.email, lead.phone, lead.service, lead.message, lead.notes, lead.next_step]
      .filter(Boolean).join(' ').toLowerCase();
    return state.query.split(/\s+/).every(term => hay.includes(term));
  }

  async function updateStatus(id, status) {
    const lead = state.leads.get(id);
    if (!lead || lead.status === status) return;
    const previous = { status: lead.status, lost_reason: lead.lost_reason ?? null };

    // Moving to "Pierdut" asks why; cancelling leaves the lead where it was
    const patch = { status };
    if (status === 'pierdut') {
      const reason = await askLostReason(lead.name);
      if (!reason) { render(); return; }
      patch.lost_reason = reason;
    }

    state.leads.set(id, { ...lead, ...patch });
    render();

    const { error } = await sb.from('leads').update(patch).eq('id', id);
    if (error) {
      console.error('[Leads] Eroare la actualizare status:', error);
      const current = state.leads.get(id);
      if (current) state.leads.set(id, { ...current, ...previous });
      render();
      toast('Nu s-a putut salva statusul.', 'error');
      return;
    }
    toast(`Mutat în „${STATUS_LABEL[status]}”`);
    refreshBriefingSoon();
  }

  // ── Routing ─────────────────────────────────────────────────────────────
  const VIEW_TITLES = { overview: 'Home', leads: 'Leads', orders: 'Comenzi' };

  function route() {
    const hash = location.hash;
    state.view = hash.startsWith('#/leads') ? 'leads' : hash.startsWith('#/orders') ? 'orders' : 'overview';
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.view === state.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    for (const view of Object.keys(VIEW_TITLES)) $(`view-${view}`).hidden = state.view !== view;
    document.title = `${VIEW_TITLES[state.view]} – CoreForm Admin`;
    if (state.view === 'leads') ensureLeads();
    if (state.view === 'orders') ensureOrders();
    chartKey = ''; // view was hidden → chart must re-measure
    closeNav();
    render();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ── Render ──────────────────────────────────────────────────────────────
  function render() {
    renderBadge();
    renderHealth();
    if (state.view === 'overview') renderBriefing();
    else if (state.view === 'leads') renderBoard();
    else renderOrders();
    state.freshIds.clear();
    state.freshOrderIds.clear();
  }

  let appBadgeCount = -1;
  function renderBadge() {
    const count = state.loaded
      ? [...state.leads.values()].filter(l => l.status === 'nou').length
      : state.briefing?.kpis?.nou ?? 0;
    const badge = $('nav-badge');
    badge.hidden = count === 0;
    badge.textContent = count;
    badge.setAttribute('aria-label', `${count} lead-uri noi`);

    // Orders waiting to be made or shipped
    const todo = state.ordersLoaded
      ? [...state.orders.values()].filter(o => ORDER_TODO.includes(o.status)).length
      : state.briefing?.kpis?.orders_todo ?? 0;
    const ordersBadge = $('orders-badge');
    ordersBadge.hidden = todo === 0;
    ordersBadge.textContent = todo;
    ordersBadge.setAttribute('aria-label', `${todo} comenzi de pregătit`);

    // Installed app: show the "Nou" count on the home-screen / dock icon
    if ('setAppBadge' in navigator && count !== appBadgeCount) {
      appBadgeCount = count;
      (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {});
    }
  }

  // ── Home / Morning Briefing ─────────────────────────────────────────────
  const KPI_DEFS = [
    { id: 'total', label: 'Total lead-uri' },
    { id: 'new',   label: 'Lead-uri noi' },
    { id: 'won',   label: 'Câștigate' },
    { id: 'conv',  label: 'Rată de conversie' },
    { id: 'pipeline', label: 'Valoare pipeline' },
    { id: 'revenue',  label: 'Încasări luna aceasta',
      hint: 'Comenzi plătite + lead-uri câștigate în luna curentă, față de aceeași perioadă a lunii trecute' }
  ];

  function renderBriefing() {
    const failed = state.briefingStatus === 'error';
    $('briefing-error').hidden = !failed;
    // The System Status panel stays visible on failure — that's when it matters.
    [$('kpis'), $('chart').closest('.panel'), $('attention-list').closest('.panel'), $('recent-list').closest('.panel')]
      .forEach(node => { node.hidden = failed; });
    if (failed) {
      const offline = !navigator.onLine;
      $('briefing-error').querySelector('strong').textContent = offline ? 'Ești offline' : 'Nu am putut încărca briefing-ul';
      $('briefing-error').querySelector('span').textContent = offline
        ? 'Briefing-ul se încarcă automat când revine conexiunea.'
        : 'Verifică conexiunea sau încearcă din nou.';
      $('briefing-summary').textContent = '';
      return;
    }
    renderSummary();
    renderKpis();
    renderChart();
    renderAttention();
    renderRecent();
  }

  function renderSummary() {
    const k = state.briefing?.kpis;
    const node = $('briefing-summary');
    if (!k) { node.textContent = 'Se pregătește briefing-ul...'; return; }
    const parts = [];
    if (k.today) parts.push(`${plural(k.today, 'lead nou', 'lead-uri noi')} azi`);
    if (k.attention) parts.push(k.today
      ? `${numFmt.format(k.attention)} care necesită atenție`
      : `${plural(k.attention, 'lead care necesită', 'lead-uri care necesită')} atenție`);
    node.textContent = parts.length
      ? `Ai ${parts.join(' și ')}.`
      : k.total ? 'Nicio cerere nouă azi. Totul e la zi.' : 'Încă nu ai lead-uri. Cererile de pe site vor apărea aici automat.';
  }

  // ── KPI cards ──
  function renderKpis() {
    const box = $('kpis');
    const k = state.briefing?.kpis;
    if (!k) {
      if (box.dataset.state !== 'skeleton') {
        box.replaceChildren(...KPI_DEFS.map(kpiSkeleton));
        box.dataset.state = 'skeleton';
      }
      return;
    }
    if (box.dataset.state !== 'ready') {
      box.replaceChildren(...KPI_DEFS.map(kpiShell));
      box.dataset.state = 'ready';
    }
    KPI_DEFS.forEach(def => updateKpi(def.id, k));
  }

  function kpiSkeleton(def) {
    return el('article', { className: 'kpi', 'aria-hidden': 'true' },
      el('div', { className: 'kpi-top' },
        el('span', { className: 'skel', style: 'width:96px;height:12px' })),
      el('span', { className: 'skel', style: 'width:72px;height:32px;margin-top:auto' }),
      el('span', { className: 'skel', style: 'width:132px;height:18px;margin-top:10px' }));
  }

  function kpiShell(def) {
    return el('article', { className: 'kpi', dataset: { kpi: def.id } },
      el('div', { className: 'kpi-top' },
        el('span', { className: 'kpi-label', text: def.label, title: def.hint || null })),
      el('div', { className: 'kpi-value-row' },
        el('div', { className: 'kpi-value', id: `kpi-${def.id}-value`, text: '0' }),
        def.id === 'new' && el('div', { className: 'segmented', role: 'group', 'aria-label': 'Perioadă' },
          [['today', 'Azi'], ['week', '7 zile']].map(([range, text]) =>
            el('button', {
              type: 'button', text, dataset: { range },
              'aria-pressed': String(state.newRange === range),
              onclick: () => setNewRange(range)
            })))),
      el('div', { className: 'kpi-foot', id: `kpi-${def.id}-foot` }));
  }

  function setNewRange(range) {
    if (state.newRange === range) return;
    state.newRange = range;
    document.querySelectorAll('.segmented button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.range === range)));
    const node = $('kpi-new-value'); // count up again from 0
    node._current = 0;
    node._target = undefined;
    updateKpi('new', state.briefing.kpis);
  }

  function updateKpi(id, k) {
    let value, suffix = '', foot;
    if (id === 'total') {
      value = k.total;
      foot = [trendChip(k.week), 'noi în ultimele 7 zile'];
    } else if (id === 'new') {
      const today = state.newRange === 'today';
      value = today ? k.today : k.week;
      foot = today
        ? [trendChip(k.today - k.yesterday), 'față de ieri']
        : [trendChip(k.week - k.prev_week), 'față de săpt. trecută'];
    } else if (id === 'won') {
      value = k.won;
      foot = [trendChip(k.won_week), 'în ultimele 7 zile'];
    } else if (id === 'pipeline') {
      // Open leads (Nou → Ofertă trimisă) with a value set
      value = k.pipeline_value == null ? null : Math.round(Number(k.pipeline_value));
      suffix = ' lei';
      foot = [k.pipeline_count
        ? `${plural(k.pipeline_count, 'lead deschis', 'lead-uri deschise')} cu valoare`
        : 'Adaugă valoarea în lead-uri'];
    } else if (id === 'revenue') {
      // Paid orders + won leads this month vs the same days last month
      const orders = k.revenue_orders == null ? null : Number(k.revenue_orders);
      value = orders == null ? null : Math.round(orders + Number(k.revenue_leads || 0));
      suffix = ' lei';
      const prev = Math.round(Number(k.revenue_orders_prev || 0) + Number(k.revenue_leads_prev || 0));
      foot = value == null ? ['—'] : [
        trendChip(value - prev),
        `${plural(k.revenue_orders_count || 0, 'comandă', 'comenzi')} · ${plural(k.revenue_leads_count || 0, 'lead', 'lead-uri')}`
      ];
    } else {
      value = k.total ? Math.round((k.won / k.total) * 100) : null;
      suffix = '%';
      foot = [`${numFmt.format(k.won)} din ${plural(k.total, 'lead', 'lead-uri')}`];
    }

    const node = $(`kpi-${id}-value`);
    if (value == null) {
      cancelAnimationFrame(node._raf);
      node.textContent = '—';
      node._current = 0;
      node._target = null;
    } else {
      animateNumber(node, value, suffix);
    }
    $(`kpi-${id}-foot`).replaceChildren(...foot.map(part =>
      typeof part === 'string' ? el('span', { className: 'trend-note', text: part }) : part));
  }

  function trendChip(diff) {
    const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    const text = diff > 0 ? `+${numFmt.format(diff)}` : diff < 0 ? `-${numFmt.format(-diff)}` : '0';
    return el('span', { className: `trend is-${dir}`, text });
  }

  // Count up from the currently shown value; ease-out-cubic.
  // Re-renders with the same target leave a running animation alone.
  function animateNumber(node, to, suffix = '') {
    if (node._target === to) return;
    const from = node._current || 0;
    node._target = to;
    cancelAnimationFrame(node._raf);
    if (reducedMotion.matches || from === to) {
      node._current = to;
      node.textContent = numFmt.format(to) + suffix;
      return;
    }
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      node._current = Math.round(from + (to - from) * eased);
      node.textContent = numFmt.format(node._current) + suffix;
      if (t < 1) node._raf = requestAnimationFrame(tick);
    };
    node._raf = requestAnimationFrame(tick);
  }

  // ── 14-day chart (inline SVG, single series → no legend; panel title names it) ──
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let chartKey = '';
  let chartAnimated = false;

  function svg(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  }

  function renderChart() {
    const box = $('chart');
    const daily = state.briefing?.daily;
    if (!daily) {
      if (!box.querySelector('.chart-skel')) {
        const heights = [30, 55, 20, 70, 45, 35, 80, 25, 60, 40, 65, 30, 50, 75];
        box.replaceChildren(el('div', { className: 'chart-skel', 'aria-hidden': 'true' },
          heights.map(h => el('span', { className: 'skel', style: `height:${h}%` }))));
      }
      $('chart-meta').textContent = '';
      return;
    }

    const width = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
    const key = JSON.stringify(daily) + '|' + Math.round(width);
    if (key === chartKey || width <= 0) return;
    chartKey = key;

    const counts = daily.map(d => d.count);
    const sum = counts.reduce((a, b) => a + b, 0);
    $('chart-meta').textContent = `${plural(sum, 'lead', 'lead-uri')} în total`;

    const H = 212, m = { top: 22, right: 4, bottom: 26, left: 28 };
    const plotW = width - m.left - m.right;
    const plotH = H - m.top - m.bottom;
    const max = Math.max(...counts);
    const yMax = max <= 4 ? 4 : Math.ceil(max / 2) * 2; // even → integer midline
    const slot = plotW / daily.length;
    const barW = Math.min(24, slot * 0.62);
    const baseY = m.top + plotH;
    const todayIdx = daily.length - 1;
    const peakIdx = counts.indexOf(max);

    const root = svg('svg', {
      width, height: H, viewBox: `0 0 ${width} ${H}`,
      tabindex: '0', role: 'img',
      'aria-label': `Lead-uri pe zi în ultimele 14 zile: ${sum} în total, maximum ${max} într-o zi. Folosește săgețile pentru detalii.`,
      class: chartAnimated ? 'no-anim' : ''
    });

    // Gridlines + y ticks (0, mid, max) — hairline, solid, recessive
    [0, yMax / 2, yMax].forEach(v => {
      const y = Math.round(baseY - (v / yMax) * plotH) + 0.5;
      root.append(svg('line', { class: 'chart-grid', x1: m.left, x2: width - m.right, y1: y, y2: y }));
      root.append(svg('text', { class: 'chart-tick', x: m.left - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, numFmt.format(v)));
    });

    const slots = daily.map((d, i) => {
      const g = svg('g', { class: 'chart-slot' });
      const x0 = m.left + i * slot;
      const x = x0 + (slot - barW) / 2;
      const h = (d.count / yMax) * plotH;
      g.append(svg('rect', { class: 'chart-hit', x: x0, y: m.top, width: slot, height: plotH }));

      if (d.count === 0) {
        g.append(svg('rect', { class: 'chart-bar is-zero', x, y: baseY - 2, width: barW, height: 2, rx: 1 }));
      } else {
        const r = Math.min(4, barW / 2, h);
        const y = baseY - h;
        g.append(svg('path', {
          class: 'chart-bar' + (i === todayIdx ? ' is-today' : ''),
          style: `--i:${i}`,
          d: `M${x},${baseY} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${baseY} Z`
        }));
      }

      // Selective direct labels: today's value and the peak
      if (d.count > 0 && (i === todayIdx || i === peakIdx)) {
        g.append(svg('text', { class: 'chart-cap', x: x + barW / 2, y: baseY - h - 6, 'text-anchor': 'middle' }, numFmt.format(d.count)));
      }
      // X labels every 2nd day, anchored on today
      if ((todayIdx - i) % 2 === 0) {
        g.append(svg('text', {
          class: 'chart-tick' + (i === todayIdx ? ' is-today' : ''),
          x: x0 + slot / 2, y: H - 6, 'text-anchor': 'middle'
        }, i === todayIdx ? 'Azi' : noDots(dayFmt.format(localDay(d.day)))));
      }
      g.addEventListener('pointerenter', () => showTip(i));
      g.addEventListener('pointerleave', hideTip);
      root.append(g);
      return { x: x0 + slot / 2, y: baseY - Math.max(h, 2), d };
    });

    const tip = el('div', { className: 'chart-tip', 'aria-hidden': 'true' });
    let active = todayIdx;
    function showTip(i) {
      active = i;
      const s = slots[i];
      const offsetX = parseFloat(getComputedStyle(box).paddingLeft);
      const offsetY = parseFloat(getComputedStyle(box).paddingTop);
      tip.replaceChildren(
        el('strong', { text: plural(s.d.count, 'lead', 'lead-uri') }),
        el('span', { text: noDots(longDayFmt.format(localDay(s.d.day))) }));
      tip.style.transform = `translate(${offsetX + s.x}px, ${offsetY + s.y}px) translate(-50%, calc(-100% - 10px))`;
      tip.classList.add('is-visible');
    }
    function hideTip() { if (document.activeElement !== root) tip.classList.remove('is-visible'); }

    root.addEventListener('focus', () => showTip(active));
    root.addEventListener('blur', () => tip.classList.remove('is-visible'));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        showTip(Math.max(0, Math.min(todayIdx, active + (e.key === 'ArrowRight' ? 1 : -1))));
      }
    });

    // Table view for screen readers
    const table = el('table', { className: 'sr-only' },
      el('caption', { text: 'Lead-uri pe zi, ultimele 14 zile' }),
      el('tbody', null, daily.map(d => el('tr', null,
        el('th', { scope: 'row', text: noDots(longDayFmt.format(localDay(d.day))) }),
        el('td', { text: String(d.count) })))));

    box.replaceChildren(root, tip, table);
    chartAnimated = true;
  }

  new ResizeObserver(() => { if (state.view === 'overview' && state.briefing) renderChart(); }).observe($('chart'));

  // ── Needs attention ──
  function renderAttention() {
    const list = $('attention-list');
    const b = state.briefing;
    if (!b) {
      list.replaceChildren(...Array.from({ length: 3 }, () => el('li', null, el('div', { className: 'skeleton is-row' }))));
      $('attention-meta').textContent = '';
      return;
    }
    const items = b.attention || [];
    const total = b.kpis.attention || items.length;
    $('attention-meta').textContent = total > items.length ? `${items.length} din ${total}` : total ? String(total) : '';

    if (!items.length) {
      list.replaceChildren(el('li', { className: 'all-clear' },
        el('strong', { text: 'Totul e la zi' }),
        'Nimic urgent azi. Pașii restanți, lead-urile necontactate, ofertele fără răspuns și comenzile întârziate apar aici.'));
      return;
    }

    list.replaceChildren(...items.map(lead => {
      const days = Math.max(1, Math.floor((Date.now() - new Date(lead.since).getTime()) / 86400000));
      const wa = waNumber(lead.phone);
      const isOrder = lead.kind === 'order';
      const title = isOrder ? `Comanda #${lead.id} · ${lead.name}` : lead.name;
      let chip, sub;
      if (isOrder) {
        const unshipped = lead.reason === 'order_unshipped';
        chip = el('span', { className: 'chip ' + (unshipped ? 'is-stale' : 'is-waiting') },
          `${unshipped ? 'Neexpediată' : 'Nelivrată'} · ${plural(days, 'zi', 'zile')}`);
        sub = formatMoney(lead.total);
      } else if (lead.reason === 'followup_due') {
        const late = -daysUntil(lead.next_step_due);
        chip = el('span', { className: 'chip ' + (late > 0 ? 'is-stale' : 'is-waiting') },
          late > 0 ? `Pas restant · ${plural(late, 'zi', 'zile')}` : 'Pas pentru azi');
        sub = lead.next_step || (showCompany(lead) ? lead.company : null);
      } else {
        const stale = lead.reason === 'stale_new';
        chip = el('span', { className: 'chip ' + (stale ? 'is-stale' : 'is-waiting') },
          `${stale ? 'Necontactat' : 'Ofertă fără răspuns'} · ${plural(days, 'zi', 'zile')}`);
        sub = showCompany(lead) ? lead.company : null;
      }
      return el('li', null,
        el('div', { className: 'attn-row' },
          el('button', { type: 'button', className: 'attn-open', onclick: () => (isOrder ? openOrder(lead.id) : openDrawer(lead.id)), 'aria-label': `Deschide ${title}` },
            el('span', { className: 'attn-name', text: title }),
            el('span', { className: 'attn-meta' },
              chip,
              sub && el('span', { className: 'attn-company', text: sub }))),
          el('div', { className: 'attn-actions' },
            wa && el('a', { className: 'link-btn', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener', 'aria-label': `WhatsApp ${lead.name}`, text: 'WhatsApp' }),
            lead.phone && el('a', { className: 'link-btn', href: `tel:${lead.phone.replace(/[^\d+]/g, '')}`, 'aria-label': `Sună ${lead.name}`, text: 'Sună' }))));
    }));
  }

  // ── Recent activity ──
  function renderRecent() {
    const list = $('recent-list');
    const recent = state.briefing?.recent;
    if (!recent) {
      list.replaceChildren(...Array.from({ length: 5 }, () => el('li', null, el('div', { className: 'skeleton is-row' }))));
      return;
    }
    if (!recent.length) {
      list.replaceChildren(el('li', { className: 'empty-state' },
        el('strong', { text: 'Încă nu ai lead-uri' }),
        'Cererile din formularele site-ului vor apărea aici automat.'));
      return;
    }
    list.replaceChildren(...recent.map(lead =>
      el('li', null,
        el('button', { type: 'button', className: 'recent-row', onclick: () => openDrawer(lead.id) },
          el('span', { style: 'min-width:0' },
            el('span', { className: 'recent-name', text: lead.name }),
            el('span', { className: 'recent-sub', text: (showCompany(lead) && lead.company) || lead.service || SOURCES[lead.source] || '—' })),
          el('span', { className: 'recent-when' },
            el('time', { className: 'recent-date', datetime: lead.created_at, text: noDots(shortDateFmt.format(new Date(lead.created_at))) }),
            el('span', { className: 'recent-ago', text: timeAgo(lead.created_at) })),
          el('span', { className: 'chip', dataset: { status: lead.status } }, el('span', { className: 'dot' }), STATUS_LABEL[lead.status])
        ))
    ));
  }

  $('briefing-retry').addEventListener('click', () => {
    state.briefingStatus = 'loading';
    render();
    loadBriefing();
  });

  // Refresh when returning to the tab after a while (also covers midnight rollover)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - state.briefingAt > 5 * 60 * 1000) loadBriefing();
  });

  function sourceChip(source, short) {
    return el('span', { className: 'chip chip-source', title: SOURCES[source] || source },
      (short ? SOURCES_SHORT : SOURCES)[source] || source);
  }

  function renderBoard() {
    const board = $('board');
    const visible = sortedLeads().filter(matches);

    const hint = $('result-hint');
    hint.hidden = !state.query;
    if (state.query) {
      hint.replaceChildren(
        `${visible.length} ${visible.length === 1 ? 'rezultat' : 'rezultate'} pentru „${state.query}”`,
        el('button', { type: 'button', text: 'Șterge filtrul', onclick: clearSearch }));
    }

    // Preserve each column's scroll position across re-renders
    const scrolls = {};
    board.querySelectorAll('.column').forEach(c => { scrolls[c.dataset.status] = c.querySelector('.column-body').scrollTop; });

    document.querySelectorAll('#owner-filter button').forEach(b =>
      b.setAttribute('aria-pressed', String((b.dataset.mine === '1') === state.mine)));

    board.replaceChildren(...STATUSES.map(status => {
      const items = visible.filter(l => l.status === status.id);
      const total = items.reduce((sum, l) => sum + (Number(l.value_lei) || 0), 0);
      const body = el('div', { className: 'column-body' });

      if (!state.loaded) {
        body.append(...Array.from({ length: status.id === 'nou' ? 3 : 1 }, () => el('div', { className: 'skeleton' })));
      } else if (!items.length) {
        body.append(el('div', { className: 'column-empty', text: state.query || state.mine ? 'Niciun rezultat' : 'Niciun lead aici' }));
      } else {
        body.append(...items.map(leadCard));
      }

      const column = el('section', { className: 'column', dataset: { status: status.id }, 'aria-label': status.label },
        el('header', { className: 'column-head' },
          el('span', { className: 'dot' }),
          el('h3', { text: status.label }),
          el('span', { className: 'column-count', text: state.loaded ? String(items.length) : '–' }),
          el('span', { className: 'column-sum' + (total ? '' : ' is-zero'), title: 'Valoarea totală a lead-urilor din coloană', text: state.loaded ? formatLei(total) : '–' })),
        body);

      if (canDrag) bindDropZone(column);
      return column;
    }));

    board.querySelectorAll('.column').forEach(c => {
      if (scrolls[c.dataset.status]) c.querySelector('.column-body').scrollTop = scrolls[c.dataset.status];
    });
  }

  document.querySelectorAll('#owner-filter button').forEach(b =>
    b.addEventListener('click', () => {
      state.mine = b.dataset.mine === '1';
      writePref('cf-leads-mine', state.mine ? '1' : '0');
      render();
    }));

  function leadCard(lead) {
    const wa = waNumber(lead.phone);
    const owner = ownerName(lead.owner_id);

    const select = el('select', {
      className: 'status-select', dataset: { status: lead.status },
      'aria-label': `Status pentru ${lead.name}`,
      onchange: (e) => updateStatus(lead.id, e.target.value)
    }, STATUSES.map(s => el('option', { value: s.id, text: s.label, selected: s.id === lead.status })));

    const card = el('article', {
      className: 'card' + (state.freshIds.has(lead.id) ? ' is-new' : ''),
      dataset: { id: lead.id },
      draggable: canDrag ? 'true' : null
    },
      el('button', { type: 'button', className: 'card-open', onclick: () => openDrawer(lead.id), 'aria-label': `Deschide ${lead.name}` },
        el('div', { className: 'card-head' },
          el('div', { className: 'card-title', text: lead.name }),
          owner && el('span', { className: 'avatar', title: `Responsabil: ${owner}`, 'aria-label': `Responsabil: ${owner}`, text: initials(owner) })),
        el('div', { className: 'card-sub' },
          showCompany(lead) && el('span', { className: 'card-company', text: lead.company }),
          el('time', { className: 'card-time', datetime: lead.created_at, title: dateFmt.format(new Date(lead.created_at)), text: timeAgo(lead.created_at) }))),
      el('div', { className: 'card-tags' },
        sourceChip(lead.source, true),
        Number(lead.value_lei) > 0 && el('span', { className: 'chip chip-value', text: formatLei(lead.value_lei) }),
        lead.duplicate_of && el('span', { className: 'chip is-waiting', title: 'Același telefon sau email ca un lead mai vechi', text: 'Posibil duplicat' })),
      lead.service && el('div', { className: 'card-service', text: lead.service }),
      OPEN_STATUSES.includes(lead.status) && (lead.next_step || lead.next_step_due) && el('div', { className: 'card-next' },
        lead.next_step_due && dueChip(lead.next_step_due),
        el('span', { className: 'card-next-text', text: lead.next_step || 'Următorul pas' })),
      lead.message && el('div', { className: 'card-msg', text: lead.message.replace(/\n\s*\n/g, ' · ').replace(/\s+/g, ' ') }),
      el('div', { className: 'card-foot' },
        select,
        (wa || lead.phone) && el('div', { className: 'card-links' },
          wa && el('a', { className: 'link-btn', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener', 'aria-label': `WhatsApp ${lead.name}`, text: 'WhatsApp', draggable: 'false' }),
          lead.phone && el('a', { className: 'link-btn', href: `tel:${lead.phone.replace(/[^\d+]/g, '')}`, 'aria-label': `Sună ${lead.name}`, text: 'Sună', draggable: 'false' })))
    );

    if (canDrag) {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', lead.id);
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => card.classList.add('is-dragging'));
      });
      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    }
    return card;
  }

  function bindDropZone(column) {
    let depth = 0;
    column.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; column.classList.add('is-over'); });
    column.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; column.classList.remove('is-over'); } });
    column.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    column.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      column.classList.remove('is-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) updateStatus(id, column.dataset.status);
    });
  }

  // ── Orders (online shop) ────────────────────────────────────────────────
  function ensureOrders() {
    if (state.ordersRequested) return;
    state.ordersRequested = true;
    loadOrders();
  }

  async function loadOrders() {
    render();
    const { data, error } = await sb.from('comenzi').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('[Comenzi] Eroare la încărcare:', error);
      state.ordersRequested = false;
      toast('Nu am putut încărca comenzile.', 'error');
      return;
    }
    state.orders = new Map(data.map(o => [o.id, o]));
    state.ordersLoaded = true;
    render();
  }

  function onOrderChange(payload) {
    if (payload.eventType === 'DELETE') {
      state.orders.delete(payload.old.id);
    } else {
      const order = payload.new;
      const before = state.orders.get(order.id);
      if (state.ordersLoaded || before) state.orders.set(order.id, order);
      if (payload.eventType === 'INSERT') {
        state.freshOrderIds.add(order.id);
        toast(`Comandă nouă #${order.id} · ${formatMoney(order.total)}`);
      } else if (before && before.status !== 'platit' && order.status === 'platit') {
        toast(`Plată confirmată · comanda #${order.id}`);
      }
    }
    render();
    refreshBriefingSoon();
  }

  // Products are a jsonb array; orders saved before Phase 6 hold a JSON string
  function orderItems(order) {
    let items = order.produse;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    return Array.isArray(items) ? items : [];
  }

  function itemsSummary(order) {
    const items = orderItems(order);
    if (!items.length) return '—';
    const first = `${items[0].name || 'Produs'}${Number(items[0].quantity) > 1 ? ` ×${items[0].quantity}` : ''}`;
    return items.length > 1 ? `${first} + încă ${items.length - 1}` : first;
  }

  function orderMatches(order) {
    if (!state.query) return true;
    const hay = [`#${order.id}`, order.nume_client, order.email, order.telefon, order.oras, order.adresa,
      order.awb, order.admin_notes, ...orderItems(order).map(i => i.name)]
      .filter(Boolean).join(' ').toLowerCase();
    return state.query.split(/\s+/).every(term => hay.includes(term));
  }

  function visibleOrders() {
    const filter = ORDER_FILTERS.find(f => f.id === state.orderFilter) || ORDER_FILTERS[0];
    return [...state.orders.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .filter(o => orderMatches(o) && filter.match(o));
  }

  function setOrderFilter(id) {
    state.orderFilter = id;
    writePref('cf-orders-filter', id);
    render();
  }

  function renderOrders() {
    const searched = [...state.orders.values()].filter(orderMatches);
    const active = ORDER_FILTERS.find(f => f.id === state.orderFilter) || ORDER_FILTERS[0];

    $('order-filters').replaceChildren(...ORDER_FILTERS.map(f => el('button', {
      type: 'button', className: 'filter-chip', 'aria-pressed': String(f.id === active.id), onclick: () => setOrderFilter(f.id)
    }, f.label, el('span', { className: 'filter-count', text: state.ordersLoaded ? String(searched.filter(f.match).length) : '–' }))));

    const visible = visibleOrders();
    const hint = $('orders-hint');
    hint.hidden = !state.query;
    if (state.query) {
      hint.replaceChildren(
        `${visible.length} ${visible.length === 1 ? 'rezultat' : 'rezultate'} pentru „${state.query}”`,
        el('button', { type: 'button', text: 'Șterge filtrul', onclick: clearSearch }));
    }

    const list = $('orders-list');
    if (!state.ordersLoaded) {
      list.replaceChildren(...Array.from({ length: 4 }, () => el('li', null, el('div', { className: 'skeleton is-row' }))));
      return;
    }
    if (!visible.length) {
      list.replaceChildren(el('li', { className: 'empty-state' },
        el('strong', { text: state.orders.size ? 'Nicio comandă aici' : 'Încă nu există comenzi' }),
        state.orders.size ? 'Schimbă filtrul sau căutarea.' : 'Comenzile din magazinul online apar aici automat.'));
      return;
    }
    list.replaceChildren(...visible.map(orderRow));
  }

  function orderRow(order) {
    const select = el('select', {
      className: 'status-select', dataset: { ostatus: order.status },
      'aria-label': `Status comanda #${order.id}`,
      onchange: (e) => updateOrderStatus(order.id, e.target.value)
    }, ORDER_STATUSES.map(s => el('option', { value: s.id, text: s.label, selected: s.id === order.status })));

    return el('li', { className: 'order-row' + (state.freshOrderIds.has(order.id) ? ' is-new' : '') },
      el('button', { type: 'button', className: 'order-open', onclick: () => openOrder(order.id), 'aria-label': `Deschide comanda #${order.id}` },
        el('strong', { className: 'order-nr', text: `#${order.id}` }),
        el('time', { className: 'order-date', datetime: order.created_at, title: dateFmt.format(new Date(order.created_at)), text: timeAgo(order.created_at) })),
      el('span', { className: 'order-client' },
        el('span', { className: 'order-name', text: order.nume_client }),
        el('span', { className: 'order-city', text: order.oras || '' })),
      el('span', { className: 'order-products', text: itemsSummary(order) }),
      el('span', { className: 'order-total', text: formatMoney(order.total) }),
      el('span', { className: 'order-pay' }, el('span', { className: 'chip chip-source', text: PAYMENT_LABEL[order.metoda_plata] || order.metoda_plata })),
      el('div', { className: 'order-status' }, select));
  }

  async function updateOrderStatus(id, status) {
    const order = state.orders.get(id);
    if (!order || order.status === status) return;

    // "Expediată" needs a tracking number: open the order with the AWB field ready
    if (status === 'expediat' && !order.awb) {
      render();
      await openOrder(id, { status, focusAwb: true });
      toast('Adaugă AWB-ul, apoi salvează ca „Expediată”.');
      return;
    }

    state.orders.set(id, { ...order, status });
    render();
    const { data, error } = await sb.from('comenzi').update({ status }).eq('id', id).select().single();
    if (error) {
      console.error('[Comenzi] Eroare la actualizare status:', error);
      const current = state.orders.get(id);
      if (current) state.orders.set(id, { ...current, status: order.status });
      render();
      toast('Nu s-a putut salva statusul comenzii.', 'error');
      return;
    }
    state.orders.set(id, data);
    render();
    toast(`Comanda #${id}: „${ORDER_STATUS_LABEL[status]}”`);
    refreshBriefingSoon();
  }

  // ── Order drawer ──
  const orderForm = $('order-form');
  const orderDrawer = $('order-drawer');
  let orderLastFocus = null;

  async function openOrder(id, opts = {}) {
    let order = state.orders.get(id);
    if (!order) {
      // Opened from Home before the orders list was loaded
      const { data, error } = await sb.from('comenzi').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        toast('Nu am putut deschide comanda.', 'error');
        return;
      }
      order = data;
      state.orders.set(id, order);
    }
    state.orderDrawerId = id;
    orderLastFocus = document.activeElement;

    $('order-title').textContent = `Comanda #${order.id}`;
    $('order-meta').textContent = `Plasată ${timeAgo(order.created_at)} · ${dateFmt.format(new Date(order.created_at))}`;

    const wa = waNumber(order.telefon);
    $('order-quick').replaceChildren(...[
      wa && waMenu({ name: order.nume_client }, wa, ORDER_WA_TEMPLATES, { nr: order.id, awb: order.awb }),
      order.telefon && el('a', { className: 'btn btn-secondary', href: `tel:${order.telefon.replace(/[^\d+]/g, '')}`, text: 'Sună' }),
      order.email && el('a', { className: 'btn btn-secondary', href: `mailto:${order.email}?subject=${encodeURIComponent(`Comanda CoreForm #${order.id}`)}`, text: 'Email' })
    ].filter(Boolean));

    const fact = (label, value) => [el('dt', { text: label }), el('dd', { text: value || '—' })];
    $('order-client').replaceChildren(
      ...fact('Nume', order.nume_client),
      ...fact('Telefon', order.telefon),
      ...fact('Email', order.email),
      ...fact('Adresă', [order.adresa, order.oras].filter(Boolean).join(', ')));

    const items = orderItems(order);
    const subtotal = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
    // Shipping = total − products; orders saved before Phase 6 can carry a few
    // bani of browser rounding, which is not a shipping fee
    const diff = Number(order.total) - subtotal;
    const shipping = diff >= 0.5 ? diff : 0;
    $('order-items').replaceChildren(...(items.length ? items.map(i => el('li', { className: 'order-item' },
      /^https:\/\//.test(i.image || '')
        ? el('img', { src: i.image, alt: '', width: '44', height: '44', loading: 'lazy', decoding: 'async' })
        : el('span', { className: 'order-item-ph', 'aria-hidden': 'true' }),
      el('span', { className: 'order-item-main' },
        el('span', { className: 'order-item-name', text: i.name || 'Produs' }),
        el('span', { className: 'order-item-sub', text: [i.color && i.color !== '—' ? `Culoare: ${i.color}` : null, `${i.quantity || 1} × ${formatMoney(i.price)}`].filter(Boolean).join(' · ') })),
      el('span', { className: 'order-item-total', text: formatMoney(Number(i.price || 0) * Number(i.quantity || 1)) })))
      : [el('li', { className: 'order-item-empty', text: 'Lista de produse nu este disponibilă.' })]));
    $('order-totals').replaceChildren(
      ...fact('Subtotal', formatMoney(subtotal)),
      ...fact('Transport', shipping ? formatMoney(shipping) : 'Gratuit'),
      el('dt', { className: 'is-total', text: 'Total' }), el('dd', { className: 'is-total', text: formatMoney(order.total) }));

    const lastPayment = Array.isArray(order.payment_log) && order.payment_log.length ? order.payment_log[order.payment_log.length - 1] : null;
    $('order-payment').replaceChildren(
      ...fact('Metodă', order.metoda_plata === 'card' ? 'Card online (Netopia)' : 'Ramburs (la livrare)'),
      ...fact('Încasată', order.paid_at ? dateFmt.format(new Date(order.paid_at)) : order.metoda_plata === 'ramburs' ? 'La livrare' : 'Încă nu'),
      ...(order.netopia_ref ? fact('Referință Netopia', order.netopia_ref) : []),
      ...(lastPayment ? fact('Ultima notificare', `${PAYMENT_OUTCOME[lastPayment.outcome] || lastPayment.outcome} · ${timeAgo(lastPayment.at)}`) : []));

    fillSelect(orderForm.status, ORDER_STATUSES.map(s => [s.id, s.label]));
    orderForm.status.value = opts.status || order.status;
    orderForm.awb.value = order.awb || '';
    orderForm.admin_notes.value = order.admin_notes || '';

    orderDrawer.querySelector('.drawer-body').scrollTop = 0;
    orderDrawer.classList.add('is-open');
    $('order-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (opts.focusAwb ? orderForm.awb : $('order-close')).focus(), 50);
  }

  const PAYMENT_OUTCOME = {
    paid: 'Plată confirmată',
    refunded: 'Plată returnată',
    amount_mismatch: 'Sumă diferită de total — verifică în Netopia',
    already_platit: 'Plată deja confirmată'
  };

  function closeOrder() {
    if (!state.orderDrawerId) return;
    state.orderDrawerId = null;
    closeWaMenu();
    orderDrawer.classList.remove('is-open');
    $('order-backdrop').classList.remove('is-open');
    document.body.style.overflow = '';
    orderLastFocus?.focus?.();
  }

  $('order-close').addEventListener('click', closeOrder);
  $('order-cancel').addEventListener('click', closeOrder);
  $('order-backdrop').addEventListener('click', closeOrder);

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = state.orderDrawerId;
    const row = {
      status: orderForm.status.value,
      awb: orderForm.awb.value.trim() || null,
      admin_notes: orderForm.admin_notes.value.trim() || null
    };
    if (row.status === 'expediat' && !row.awb) {
      orderForm.awb.focus();
      toast('Completează AWB-ul pentru „Expediată”.', 'error');
      return;
    }

    const saveBtn = $('order-save');
    saveBtn.disabled = true;
    const { data, error } = await sb.from('comenzi').update(row).eq('id', id).select().single();
    saveBtn.disabled = false;
    if (error) {
      console.error('[Comenzi] Eroare la salvare:', error);
      toast(/AWB/.test(error.message || '') ? 'Completează AWB-ul pentru „Expediată”.' : 'Nu s-a putut salva comanda.', 'error');
      return;
    }
    state.orders.set(id, data);
    closeOrder();
    render();
    toast('Comanda a fost salvată');
    refreshBriefingSoon();
  });

  // ── CSV export (Excel RO: ";" separator, UTF-8 BOM, comma decimals) ─────
  // Cells that start with = + - @ are prefixed with ' so a value typed into a
  // public form can never run as a spreadsheet formula. Phone numbers are
  // wrapped as ="…" to keep the leading 0 / + exactly as typed.
  function csvCell(value) {
    if (value == null) return '';
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const csvPhone = (p) => (p ? `="${String(p).replace(/"/g, '')}"` : '');
  const csvNum = (n) => (n == null || n === '' ? '' : String(Number(n)).replace('.', ','));
  function csvDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function downloadCsv(filename, headers, rows) {
    const lines = [headers.map(csvCell), ...rows.map(r => r.map(c => (c && c.raw != null ? c.raw : csvCell(c))))];
    const blob = new Blob(['﻿' + lines.map(r => r.join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  $('leads-csv-btn').addEventListener('click', () => {
    if (!state.loaded) { toast('Lead-urile se încarcă încă. Încearcă din nou.'); return; }
    const rows = sortedLeads().filter(matches);
    downloadCsv(`CoreForm_Leaduri_${today()}.csv`,
      ['Data', 'Nume', 'Firmă', 'Telefon', 'Email', 'Sursă', 'Canal', 'Campanie', 'Serviciu', 'Status', 'Motiv pierdere',
       'Responsabil', 'Valoare (lei)', 'Următorul pas', 'Termen', 'Mesaj', 'Notițe'],
      rows.map(l => [csvDate(l.created_at), l.name, l.company, { raw: csvPhone(l.phone) }, l.email,
        SOURCES[l.source] || l.source, CHANNELS[l.channel] || l.channel, l.campaign, l.service,
        STATUS_LABEL[l.status] || l.status, LOST_REASONS[l.lost_reason] || l.lost_reason,
        ownerName(l.owner_id), { raw: csvNum(l.value_lei) }, l.next_step, l.next_step_due, l.message, l.notes]));
    toast(`Export: ${plural(rows.length, 'lead', 'lead-uri')}`);
  });

  $('orders-csv-btn').addEventListener('click', () => {
    if (!state.ordersLoaded) { toast('Comenzile se încarcă încă. Încearcă din nou.'); return; }
    const rows = visibleOrders();
    downloadCsv(`CoreForm_Comenzi_${today()}.csv`,
      ['Nr', 'Data', 'Client', 'Telefon', 'Email', 'Adresă', 'Oraș', 'Produse', 'Total (lei)', 'Plată', 'Status',
       'Încasată la', 'Expediată la', 'AWB', 'Livrată la', 'Canal', 'Notițe'],
      rows.map(o => [o.id, csvDate(o.created_at), o.nume_client, { raw: csvPhone(o.telefon) }, o.email, o.adresa, o.oras,
        orderItems(o).map(i => `${i.name} ×${i.quantity || 1}${i.color && i.color !== '—' ? ` (${i.color})` : ''}`).join('; '),
        { raw: csvNum(o.total) }, PAYMENT_LABEL[o.metoda_plata] || o.metoda_plata, ORDER_STATUS_LABEL[o.status] || o.status,
        csvDate(o.paid_at), csvDate(o.shipped_at), o.awb, csvDate(o.delivered_at), CHANNELS[o.channel] || o.channel, o.admin_notes]));
    toast(`Export: ${plural(rows.length, 'comandă', 'comenzi')}`);
  });

  // ── Search ──────────────────────────────────────────────────────────────
  const searchInput = $('search-input');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = searchInput.value.trim().toLowerCase();
      // Search applies to the full leads list — jump to the board from Home.
      if (state.query && state.view === 'overview') { location.hash = '#/leads'; return; }
      render();
    }, 120);
  });
  searchInput.addEventListener('blur', () => {
    if (!searchInput.value) document.body.classList.remove('search-open');
  });

  function clearSearch() {
    searchInput.value = '';
    state.query = '';
    document.body.classList.remove('search-open');
    render();
  }

  $('search-toggle').addEventListener('click', () => {
    document.body.classList.add('search-open');
    searchInput.focus();
  });

  // ── Mobile nav ──────────────────────────────────────────────────────────
  function closeNav() {
    document.body.classList.remove('nav-open');
    $('sidebar-backdrop').classList.remove('is-open');
    $('menu-toggle').setAttribute('aria-expanded', 'false');
  }
  $('menu-toggle').addEventListener('click', () => {
    document.body.classList.add('nav-open');
    $('sidebar-backdrop').classList.add('is-open');
    $('menu-toggle').setAttribute('aria-expanded', 'true');
  });
  $('sidebar-backdrop').addEventListener('click', closeNav);

  // ── Drawer ──────────────────────────────────────────────────────────────
  const form = $('lead-form');
  const drawer = $('drawer');
  const deleteBtn = $('delete-btn');
  let lastFocus = null;

  const FORM_FIELDS = ['name', 'company', 'phone', 'email', 'source', 'status', 'service', 'message', 'notes',
    'owner_id', 'value_lei', 'next_step', 'next_step_due', 'lost_reason', 'channel'];

  function fillSelect(select, options) {
    select.replaceChildren(...options.map(([value, label]) => el('option', { value, text: label })));
  }

  function syncLostField() {
    const lost = form.status.value === 'pierdut';
    $('lost-field').hidden = !lost;
    form.lost_reason.required = lost;
  }
  form.status.addEventListener('change', syncLostField);

  // "Google Ads · campania „toamna” · a intrat pe /oferta.html · prima vizită 12 oct"
  function channelInfo(lead) {
    const a = lead.attribution || {};
    const touch = a.first || a.last || {};
    const parts = [CHANNELS[lead.channel] || 'Necunoscut'];
    if (lead.campaign) parts.push(`campania „${lead.campaign}”`);
    if (touch.referrer && !['direct', 'google_ads', 'meta_ads'].includes(lead.channel)) parts.push(`de pe ${touch.referrer}`);
    if (touch.landing) parts.push(`a intrat pe ${touch.landing}`);
    if (a.first?.at) parts.push(`prima vizită ${noDots(dayFmt.format(new Date(a.first.at)))}`);
    return parts.join(' · ');
  }

  // ── Tabs: Detalii / Istoric ──
  function selectTab(which) {
    const history = which === 'history';
    $('tab-details').hidden = history;
    $('tab-history').hidden = !history;
    [['tab-btn-details', !history], ['tab-btn-history', history]].forEach(([id, on]) => {
      $(id).setAttribute('aria-selected', String(on));
      $(id).tabIndex = on ? 0 : -1;
    });
    if (history && historyFor !== state.drawerId) loadHistory(state.drawerId);
  }
  $('tab-btn-details').addEventListener('click', () => selectTab('details'));
  $('tab-btn-history').addEventListener('click', () => selectTab('history'));
  $('drawer-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = $('tab-btn-details').getAttribute('aria-selected') === 'true' ? 'history' : 'details';
    selectTab(next);
    $(`tab-btn-${next}`).focus();
  });

  // ── History (lead_activity, written by database triggers) ──
  let historyFor = null; // lead id whose timeline is currently shown

  async function loadHistory(id) {
    const list = $('timeline');
    historyFor = id;
    list.replaceChildren(...Array.from({ length: 3 }, () => el('li', null, el('div', { className: 'skeleton is-row' }))));
    const { data, error } = await sb.from('lead_activity').select('*')
      .eq('lead_id', id).order('at', { ascending: false }).limit(200);
    if (historyFor !== id) return;
    if (error) {
      console.error('[Istoric] Eroare la încărcare:', error);
      historyFor = null;
      list.replaceChildren(el('li', { className: 'timeline-empty', text: 'Nu am putut încărca istoricul.' }));
      return;
    }
    list.replaceChildren(...(data.length
      ? data.map(historyItem)
      : [el('li', { className: 'timeline-empty', text: 'Încă nu există modificări înregistrate.' })]));
  }

  function addHistoryEntry(row) {
    if (!row || row.lead_id !== historyFor) return;
    const list = $('timeline');
    list.querySelector('.timeline-empty')?.remove();
    list.prepend(historyItem(row));
  }

  const stepText = (v) => v.replace(/\d{4}-\d{2}-\d{2}/, (d) => noDots(dayFmt.format(localDay(d))));

  function historyText(row) {
    const lei = (v) => (v == null ? '—' : formatLei(v));
    const owner = (v) => (v ? state.admins.get(v) || 'Admin' : 'Neasignat');
    switch (row.kind) {
      case 'created':     return `Lead creat · ${SOURCES[row.to_value] || row.to_value || '—'}`;
      case 'status':      return `Status: ${STATUS_LABEL[row.from_value] || row.from_value} → ${STATUS_LABEL[row.to_value] || row.to_value}`;
      case 'owner':       return `Responsabil: ${owner(row.from_value)} → ${owner(row.to_value)}`;
      case 'value':       return `Valoare: ${lei(row.from_value)} → ${lei(row.to_value)}`;
      case 'next_step':   return row.to_value ? `Următorul pas: ${stepText(row.to_value)}` : 'Următorul pas a fost șters';
      case 'lost_reason': return `Motiv pierdere: ${LOST_REASONS[row.to_value] || row.to_value}`;
      default:            return row.kind;
    }
  }

  function historyItem(row) {
    const who = row.actor_id ? state.admins.get(row.actor_id) || 'Admin' : row.kind === 'created' ? 'Website' : 'Sistem';
    return el('li', { className: 'timeline-item', dataset: { kind: row.kind } },
      el('span', { className: 'timeline-dot', 'aria-hidden': 'true' }),
      el('div', { className: 'timeline-body' },
        el('div', { className: 'timeline-text', text: historyText(row) }),
        el('div', { className: 'timeline-meta' },
          `${who} · `,
          el('time', { datetime: row.at, title: dateFmt.format(new Date(row.at)), text: timeAgo(row.at) }))));
  }

  // ── WhatsApp templates ──
  // who = { name, company }; vars fill {nr} / {awb} in order templates
  function fillTemplate(text, who, vars = {}) {
    const name = (who.name || '').trim();
    const person = name && name !== who.company && name !== 'Fără nume' ? name.split(/\s+/)[0] : '';
    return text
      .replace('{salut}', person ? `Bună, ${person}!` : 'Bună ziua!')
      .replace(/\{eu\}/g, state.userName || 'echipa CoreForm')
      .replace(/\{(nr|awb)\}/g, (_, key) => vars[key] ?? '');
  }

  function waMenu(who, wa, templates = WA_TEMPLATES, vars = {}) {
    const menu = el('div', { className: 'wa-menu', role: 'menu', hidden: true },
      templates.filter(t => !t.needsAwb || vars.awb).map(t => el('a', {
        className: 'wa-item', role: 'menuitem', target: '_blank', rel: 'noopener',
        href: `https://wa.me/${wa}` + (t.text ? `?text=${encodeURIComponent(fillTemplate(t.text, who, vars))}` : ''),
        title: t.text ? fillTemplate(t.text, who, vars) : 'Deschide conversația fără text',
        text: t.label,
        onclick: closeWaMenu
      })));
    const btn = el('button', {
      type: 'button', className: 'btn btn-secondary wa-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', text: 'WhatsApp',
      onclick: () => {
        const open = menu.hidden;
        closeWaMenu();
        menu.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        if (open) menu.querySelector('a').focus();
      }
    });
    return el('div', { className: 'wa-wrap' }, btn, menu);
  }

  function closeWaMenu() {
    document.querySelectorAll('.wa-menu').forEach(m => { m.hidden = true; });
    document.querySelectorAll('.wa-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.wa-wrap')) closeWaMenu(); });

  // ── Lost reason (asked when a lead moves to "Pierdut" from the board) ──
  function askLostReason(name) {
    const dialog = $('lost-dialog');
    $('lost-name').textContent = name;
    return new Promise((resolve) => {
      let picked = null;
      $('lost-options').replaceChildren(...Object.entries(LOST_REASONS).map(([id, label]) =>
        el('button', { type: 'button', className: 'btn btn-secondary', text: label, onclick: () => { picked = id; dialog.close(); } })));
      dialog.addEventListener('close', () => resolve(picked), { once: true });
      dialog.showModal();
    });
  }
  $('lost-cancel').addEventListener('click', () => $('lost-dialog').close());

  function openDrawer(id) {
    const lead = id === 'new' ? null : findLead(id);
    if (id !== 'new' && !lead) return;
    state.drawerId = id;
    lastFocus = document.activeElement;

    const isNew = !lead;
    $('drawer-title').textContent = isNew ? 'Lead nou' : lead.name;
    $('drawer-meta').textContent = isNew
      ? 'Adaugă manual o conversație de pe WhatsApp sau telefon.'
      : `Primit ${timeAgo(lead.created_at)} · ${dateFmt.format(new Date(lead.created_at))}`;

    // Website sources can't be picked manually, but stay visible on existing leads
    const sourceIds = isNew || MANUAL_SOURCES.includes(lead.source) ? MANUAL_SOURCES : [lead.source, ...MANUAL_SOURCES];
    fillSelect(form.source, sourceIds.map(s => [s, SOURCES[s] || s]));
    fillSelect(form.status, STATUSES.map(s => [s.id, s.label]));
    fillSelect(form.lost_reason, [['', 'Alege motivul'], ...Object.entries(LOST_REASONS)]);
    fillSelect(form.channel, [['', 'Necunoscut'], ...Object.entries(CHANNELS)]);

    const values = lead || { source: 'whatsapp', status: 'nou', owner_id: state.userId };
    const owners = [...state.admins];
    if (values.owner_id && !state.admins.has(values.owner_id)) owners.push([values.owner_id, 'Admin']);
    fillSelect(form.owner_id, [['', 'Neasignat'], ...owners]);
    for (const key of FORM_FIELDS) form[key].value = values[key] ?? '';
    syncLostField();

    // Website leads carry their own channel (attribution); manual ones get a picker
    const tracked = !!lead?.attribution;
    $('channel-field').hidden = tracked;
    $('channel-info').hidden = !tracked;
    if (tracked) {
      $('channel-info').replaceChildren(el('span', { className: 'channel-label', text: 'Canal' }), el('span', { text: channelInfo(lead) }));
    }

    // Possible duplicate → link to the original lead
    const dup = $('dup-banner');
    const original = lead?.duplicate_of && findLead(lead.duplicate_of);
    dup.hidden = !lead?.duplicate_of;
    if (lead?.duplicate_of) {
      dup.replaceChildren(
        el('strong', { text: 'Posibil duplicat' }),
        el('span', { text: 'Același telefon sau email ca ' }),
        original
          ? el('button', { type: 'button', className: 'link-btn', text: original.name, onclick: () => openDrawer(original.id) })
          : el('span', { text: 'un lead mai vechi.' }));
    }

    // Quick actions
    const quick = $('drawer-quick');
    const wa = lead && waNumber(lead.phone);
    quick.replaceChildren(...(lead ? [
      wa && waMenu(lead, wa),
      lead.phone && el('a', { className: 'btn btn-secondary', href: `tel:${lead.phone.replace(/[^\d+]/g, '')}`, text: 'Sună' }),
      lead.email && el('a', { className: 'btn btn-secondary', href: `mailto:${lead.email}`, text: 'Email' })
    ].filter(Boolean) : []));
    quick.hidden = !quick.children.length;

    $('drawer-tabs').hidden = isNew;
    historyFor = null;
    selectTab('details');

    deleteBtn.hidden = isNew;
    resetDeleteBtn();
    $('save-btn').textContent = isNew ? 'Adaugă lead' : 'Salvează';

    drawer.querySelector('.drawer-body').scrollTop = 0;
    drawer.classList.add('is-open');
    $('drawer-backdrop').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (isNew ? form.name : $('drawer-close')).focus(), 50);
  }

  function closeDrawer() {
    if (!state.drawerId) return;
    state.drawerId = null;
    historyFor = null;
    drawer.classList.remove('is-open');
    $('drawer-backdrop').classList.remove('is-open');
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  }

  function resetDeleteBtn() {
    deleteBtn.classList.remove('is-confirming');
    deleteBtn.textContent = 'Șterge';
    delete deleteBtn.dataset.armed;
  }

  $('new-lead-btn').addEventListener('click', () => openDrawer('new'));
  $('drawer-close').addEventListener('click', closeDrawer);
  $('cancel-btn').addEventListener('click', closeDrawer);
  $('drawer-backdrop').addEventListener('click', closeDrawer);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.name.value.trim()) {
      form.name.focus();
      form.name.reportValidity();
      return;
    }

    const row = {};
    for (const key of FORM_FIELDS) {
      const v = form[key].value.trim();
      row[key] = v || null;
    }
    if (row.value_lei != null) {
      row.value_lei = Number(row.value_lei);
      if (!Number.isFinite(row.value_lei) || row.value_lei < 0) {
        selectTab('details');
        form.value_lei.focus();
        toast('Valoarea trebuie să fie un număr pozitiv.', 'error');
        return;
      }
    }
    if (row.status === 'pierdut' && !row.lost_reason) {
      selectTab('details');
      form.lost_reason.focus();
      form.lost_reason.reportValidity();
      return;
    }
    if (row.status !== 'pierdut') row.lost_reason = null;
    if ($('channel-field').hidden) delete row.channel; // derived from attribution

    const saveBtn = $('save-btn');
    saveBtn.disabled = true;

    const isNew = state.drawerId === 'new';
    state.savingNew = isNew;
    const query = isNew
      ? sb.from('leads').insert(row).select().single()
      : sb.from('leads').update(row).eq('id', state.drawerId).select().single();
    const { data, error } = await query;
    saveBtn.disabled = false;
    state.savingNew = false;

    if (error) {
      console.error('[Leads] Eroare la salvare:', error);
      toast('Nu s-a putut salva lead-ul.', 'error');
      return;
    }

    if (isNew) state.freshIds.add(data.id);
    state.leads.set(data.id, data);
    closeDrawer();
    render();
    toast(isNew ? 'Lead adăugat' : 'Modificări salvate');
    refreshBriefingSoon();
  });

  deleteBtn.addEventListener('click', async () => {
    if (!deleteBtn.dataset.armed) {
      deleteBtn.dataset.armed = '1';
      deleteBtn.classList.add('is-confirming');
      deleteBtn.textContent = 'Confirmă ștergerea';
      setTimeout(resetDeleteBtn, 4000);
      return;
    }
    const id = state.drawerId;
    deleteBtn.disabled = true;
    const { error } = await sb.from('leads').delete().eq('id', id);
    deleteBtn.disabled = false;
    if (error) {
      console.error('[Leads] Eroare la ștergere:', error);
      toast('Nu s-a putut șterge lead-ul.', 'error');
      return;
    }
    state.leads.delete(id);
    closeDrawer();
    render();
    toast('Lead șters');
    refreshBriefingSoon();
  });

  // ── Monthly PDF report ──────────────────────────────────────────────────
  // html2pdf is lazy-loaded on first use (exact pinned version).
  const HTML2PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  const MONTHS_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const monthLabel = (date) => `${capital(MONTHS_RO[date.getMonth()])} ${date.getFullYear()}`;
  const pad2 = (n) => String(n).padStart(2, '0');
  let html2pdfLoading = null;

  function fillReportMonths() {
    const now = new Date();
    $('report-month').replaceChildren(...Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return el('option', { value: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`, text: monthLabel(d) });
    }));
  }

  function loadHtml2pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    html2pdfLoading = html2pdfLoading || new Promise((resolve, reject) => {
      const script = el('script', { src: HTML2PDF_URL, crossorigin: 'anonymous', referrerpolicy: 'no-referrer' });
      script.onload = () => resolve(window.html2pdf);
      script.onerror = () => { html2pdfLoading = null; reject(new Error('Nu am putut încărca generatorul PDF.')); };
      document.head.append(script);
    });
    return html2pdfLoading;
  }

  function setReportBusy(busy) {
    const btn = $('report-btn');
    btn.disabled = busy;
    $('report-month').disabled = busy;
    const spinner = btn.querySelector('.spinner');
    if (busy && !spinner) btn.prepend(el('span', { className: 'spinner', 'aria-hidden': 'true' }));
    if (!busy) spinner?.remove();
    $('report-btn-text').textContent = busy ? 'Se generează...' : 'Descarcă raport PDF';
  }

  async function downloadReport() {
    const monthIso = $('report-month').value;
    const monthDate = localDay(monthIso);
    setReportBusy(true);
    let node;
    try {
      const [lib, { data, error }] = await Promise.all([
        loadHtml2pdf(),
        sb.rpc('get_monthly_report', { p_month: monthIso, tz: 'Europe/Bucharest' })
      ]);
      if (error) throw error;

      const report = buildReport(data, monthDate);
      // The PDF is always printed in the light theme, whatever the page uses
      node = el('div', { className: 'report-stage', 'aria-hidden': 'true', dataset: { theme: 'light' } }, report);
      document.body.append(node);
      await document.fonts.ready;
      await Promise.all([...node.querySelectorAll('img')].map(img => img.decode().catch(() => {})));

      const filename = `CoreForm_Report_${monthLabel(monthDate).replace(' ', '_')}.pdf`;
      await lib()
        .set({
          margin: [12, 12, 14, 12],
          filename,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.r-block', '.r-kpis'] }
        })
        .from(report)
        .toPdf()
        .get('pdf')
        .then((pdf) => {
          // Page numbers — ASCII only (jsPDF's built-in fonts lack ș/ț)
          const pages = pdf.internal.getNumberOfPages();
          const w = pdf.internal.pageSize.getWidth();
          const h = pdf.internal.pageSize.getHeight();
          for (let i = 1; i <= pages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(140, 146, 142);
            pdf.text(`Pagina ${i} / ${pages}`, w - 12, h - 6, { align: 'right' });
          }
        })
        .save();
      toast('Raport descărcat');
    } catch (err) {
      console.error('[Raport] Eroare la generare:', err);
      toast(navigator.onLine ? 'Nu am putut genera raportul.' : 'Raportul are nevoie de conexiune la internet.', 'error');
    } finally {
      node?.remove();
      setReportBusy(false);
    }
  }

  function buildReport(data, monthDate) {
    const k = data.kpis, p = data.prev;
    const conv = k.total ? Math.round((k.won / k.total) * 100) : null;
    const prevConv = p.total ? Math.round((p.won / p.total) * 100) : null;
    const prevName = MONTHS_RO[new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1).getMonth()];
    const shortDT = new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    const delta = (diff, unit = '') => {
      if (diff == null) return el('span', { className: 'r-delta', text: `— față de ${prevName}` });
      const cls = diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : '';
      const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
      return el('span', { className: `r-delta ${cls}`, text: `${sign}${numFmt.format(Math.abs(diff))}${unit} față de ${prevName}` });
    };
    const kpi = (label, value, d) => el('div', { className: 'r-kpi' },
      el('div', { className: 'r-kpi-label', text: label }),
      el('div', { className: 'r-kpi-value', text: value }),
      d);

    // Leads per day — HTML columns (html2canvas renders these reliably)
    const counts = data.daily.map(d => d.count);
    const max = Math.max(1, ...counts);
    const peak = Math.max(...counts);
    const lastDay = data.daily.length;
    const chart = el('div', { className: 'r-block' },
      el('h2', { className: 'r-h2' }, 'Lead-uri pe zi', el('span', { text: peak ? `maximum ${peak} într-o zi` : '' })),
      el('div', { className: 'r-chart' }, data.daily.map(d => el('div', { className: 'r-bar-wrap' },
        d.count === peak && peak > 0 && el('span', { className: 'r-bar-val', text: String(d.count) }),
        el('div', { className: 'r-bar' + (d.count ? '' : ' is-zero'), style: `height:${(d.count / max) * 100}%` })))),
      el('div', { className: 'r-axis' }, data.daily.map((d, i) => {
        const day = i + 1;
        return el('span', { text: day === 1 || day % 5 === 0 || day === lastDay ? String(day) : '' });
      })));

    const breakdown = (title, rows, labelOf, statusKey) => {
      const total = rows.reduce((a, r) => a + r.count, 0) || 1;
      return el('div', null,
        el('h2', { className: 'r-h2', text: title }),
        rows.length
          ? el('table', { className: 'r-breakdown' }, el('tbody', null, rows.map(r => el('tr', null,
              el('td', { className: 'r-name-cell' }, statusKey
                ? el('span', { className: 'r-chip', dataset: { status: r.status }, text: labelOf(r) })
                : labelOf(r)),
              el('td', null, el('div', { className: 'r-prop' }, el('span', { style: `width:${(r.count / total) * 100}%` }))),
              el('td', { text: numFmt.format(r.count) })))))
          : el('div', { className: 'r-empty', text: '—' }));
    };

    const leadsTable = data.leads.length
      ? el('table', { className: 'r-table' },
          el('thead', null, el('tr', null, ['Data', 'Nume', 'Firmă', 'Sursă', 'Status'].map(h => el('th', { text: h })))),
          el('tbody', null, data.leads.map(l => el('tr', null,
            el('td', { className: 'r-muted', text: shortDT.format(new Date(l.created_at)) }),
            el('td', { text: l.name }),
            el('td', { className: 'r-muted', text: l.company || '—' }),
            el('td', { text: SOURCES_SHORT[l.source] || l.source }),
            el('td', null, el('span', { className: 'r-chip', dataset: { status: l.status }, text: STATUS_LABEL[l.status] || l.status }))))))
      : el('div', { className: 'r-empty', text: 'Nicio cerere în această lună.' });

    // Revenue (Phase 6): paid orders + won leads, and the month's paid orders
    const revenue = data.revenue;
    const revenueTotal = revenue ? Number(revenue.orders || 0) + Number(revenue.leads || 0) : 0;
    const orders = data.orders || [];
    const revenueBlock = revenue && el('div', { className: 'r-block' },
      el('h2', { className: 'r-h2' }, 'Încasări', el('span', { text: formatLei(revenueTotal) })),
      el('table', { className: 'r-breakdown r-revenue' }, el('tbody', null,
        el('tr', null,
          el('td', { className: 'r-name-cell', text: 'Comenzi plătite' }),
          el('td', { className: 'r-muted', text: plural(Number(revenue.orders_count || 0), 'comandă', 'comenzi') }),
          el('td', { text: formatMoney(revenue.orders) })),
        el('tr', null,
          el('td', { className: 'r-name-cell', text: 'Lead-uri câștigate' }),
          el('td', { className: 'r-muted', text: plural(Number(revenue.leads_count || 0), 'lead cu valoare', 'lead-uri cu valoare') }),
          el('td', { text: formatMoney(revenue.leads) })))),
      orders.length
        ? el('table', { className: 'r-table r-orders' },
            el('thead', null, el('tr', null, ['Încasată', 'Nr', 'Client', 'Oraș', 'Plată', 'Total'].map(h => el('th', { text: h })))),
            el('tbody', null, orders.map(o => el('tr', null,
              el('td', { className: 'r-muted', text: shortDT.format(new Date(o.paid_at)) }),
              el('td', { text: `#${o.id}` }),
              el('td', { text: o.nume_client }),
              el('td', { className: 'r-muted', text: o.oras || '—' }),
              el('td', { text: PAYMENT_LABEL[o.metoda_plata] || o.metoda_plata }),
              el('td', { className: 'r-num', text: formatMoney(o.total) })))))
        : el('div', { className: 'r-empty', text: 'Nicio comandă plătită în această lună.' }));

    return el('div', { className: 'report' },
      el('div', { className: 'r-head' },
        el('img', { src: 'img/logo-green-320.png', alt: '', width: '38', height: '42' }),
        el('div', { className: 'r-brand' }, 'CoreForm', el('small', { text: 'Admin · Raport lunar' })),
        el('div', { className: 'r-head-meta' },
          `Generat ${dateFmt.format(new Date())}`, el('br'), state.userName ? `de ${state.userName}` : '')),
      el('h1', { className: 'r-title', text: `Raport lunar · ${monthLabel(monthDate)}` }),
      el('p', { className: 'r-sub', text: k.total
        ? `${capital(plural(k.total, 'lead primit', 'lead-uri primite'))}, ${plural(k.won, 'câștigat', 'câștigate')}. Comparație cu ${prevName}.`
        : 'Nicio cerere înregistrată în această lună.' }),
      el('div', { className: 'r-kpis' + (revenue ? ' has-revenue' : '') },
        kpi('Lead-uri', numFmt.format(k.total), delta(k.total - p.total)),
        kpi('Câștigate', numFmt.format(k.won), delta(k.won - p.won)),
        kpi('Rată de conversie', conv == null ? '—' : `${conv}%`, delta(conv == null || prevConv == null ? null : conv - prevConv, ' pp')),
        kpi('În lucru', numFmt.format(k.in_progress), delta(k.in_progress - p.in_progress)),
        revenue && kpi('Încasări', formatLei(revenueTotal), delta(Math.round(revenueTotal - Number(revenue.prev_total || 0)), ' lei'))),
      chart,
      revenue && revenueBlock,
      el('div', { className: 'r-block r-split' },
        breakdown('După status', data.by_status, r => STATUS_LABEL[r.status] || r.status, true),
        breakdown('După sursă', data.by_source, r => SOURCES[r.source] || r.source, false)),
      el('div', null,
        el('h2', { className: 'r-h2' }, 'Toate lead-urile lunii', el('span', { text: plural(data.leads.length, 'înregistrare', 'înregistrări') })),
        leadsTable),
      el('div', { className: 'r-foot' },
        el('span', { text: 'Generat din CoreForm Admin · coreform.ro' }),
        el('span', { text: 'Ora României (Europe/Bucharest)' })));
  }

  $('report-btn').addEventListener('click', downloadReport);

  // ── System status (real checks — nothing hard-coded) ────────────────────
  const health = {
    db: { state: 'checking', value: 'Se verifică...' },
    uptime: null,       // only when UPTIMEROBOT_KEY is configured AND reachable
    uptimeAt: 0,
    realtime: 'checking',
    checkedAt: 0
  };

  function httpsHealth() {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (location.protocol === 'https:' && window.isSecureContext) return { state: 'ok', value: 'Activă · HTTPS' };
    if (local) return { state: 'ok', value: 'Local (dezvoltare)' };
    return { state: 'error', value: 'Nesecurizată (HTTP)' };
  }

  function liveHealth() {
    if (!navigator.onLine) return { state: 'error', value: 'Offline' };
    if (health.realtime === 'SUBSCRIBED') return { state: 'ok', value: 'Conectat' };
    if (health.realtime === 'checking') return { state: 'checking', value: 'Se conectează...' };
    return { state: 'error', value: 'Deconectat' };
  }

  function syncHealth() {
    if (state.briefingStatus === 'error') return { state: 'warn', value: 'Eșuată' };
    if (!state.briefingAt) return { state: 'checking', value: '—' };
    return { state: 'ok', value: timeAgo(new Date(state.briefingAt).toISOString()) };
  }

  async function checkHealth() {
    if (!navigator.onLine) {
      health.db = { state: 'error', value: 'Offline' };
    } else {
      const started = performance.now();
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
        const { error } = await Promise.race([sb.from('leads').select('id', { head: true }).limit(1), timeout]);
        if (error) throw error;
        const ms = Math.round(performance.now() - started);
        health.db = ms > 1500 ? { state: 'warn', value: `Lentă · ${ms} ms` } : { state: 'ok', value: `Online · ${ms} ms` };
      } catch (err) {
        console.warn('[Health] Baza de date nu răspunde:', err);
        health.db = { state: 'error', value: 'Indisponibilă' };
      }
    }
    if (window.UPTIMEROBOT_KEY && navigator.onLine && Date.now() - health.uptimeAt > 10 * 60 * 1000) {
      health.uptime = await fetchUptime();
      health.uptimeAt = Date.now();
    }
    health.checkedAt = Date.now();
    renderHealth();
  }

  // Real 30-day uptime from UptimeRobot (read-only, monitor-specific key).
  async function fetchUptime() {
    try {
      const res = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ api_key: window.UPTIMEROBOT_KEY, format: 'json', custom_uptime_ratios: '30' })
      });
      const json = await res.json();
      const ratio = parseFloat(json?.monitors?.[0]?.custom_uptime_ratio);
      if (json.stat !== 'ok' || Number.isNaN(ratio)) return null;
      const value = `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(ratio)}%`;
      return { state: ratio >= 99.5 ? 'ok' : ratio >= 98 ? 'warn' : 'error', value };
    } catch (err) {
      console.warn('[Health] Uptime indisponibil (linia rămâne ascunsă):', err);
      return null;
    }
  }

  function renderHealth() {
    const offline = !navigator.onLine;
    $('live-indicator').classList.toggle('is-off', offline || health.realtime !== 'SUBSCRIBED');
    const rows = [
      ['Conexiune securizată', httpsHealth()],
      ['Bază de date', offline ? { state: 'error', value: 'Offline' } : health.db],
      ['Actualizări live', liveHealth()],
      ['Ultima sincronizare', syncHealth()],
      health.uptime && ['Uptime 30 zile', health.uptime]
    ].filter(Boolean);

    const states = rows.map(([, r]) => r.state);
    const failing = rows.filter(([, r]) => r.state === 'error').map(([label]) => label.toLowerCase());
    let overall, title, sub;
    if (offline) {
      [overall, title, sub] = ['error', 'Ești offline', 'Ne reconectăm automat'];
    } else if (failing.length) {
      [overall, title, sub] = ['error', 'Probleme detectate', `Afectat: ${failing.join(', ')}`];
    } else if (states.includes('warn')) {
      [overall, title, sub] = ['warn', 'Performanță redusă', 'Unele servicii răspund mai greu'];
    } else if (states.includes('checking')) {
      [overall, title, sub] = ['checking', 'Se verifică sistemele...', 'Câteva secunde'];
    } else {
      [overall, title, sub] = ['ok', 'Toate sistemele funcționează', 'Conexiune securizată · date sincronizate'];
    }

    $('status-hero').dataset.health = overall;
    $('status-title').textContent = title;
    $('status-sub').textContent = sub;
    $('status-checked').textContent = health.checkedAt ? `verificat ${timeAgo(new Date(health.checkedAt).toISOString())}` : '';

    const mini = $('sys-mini');
    mini.dataset.health = overall;
    $('sys-mini-text').textContent = overall === 'ok' ? 'Toate sistemele OK' : title;
    mini.setAttribute('aria-label', `Stare sistem: ${title}`);

    $('status-list').replaceChildren(...rows.map(([label, r]) =>
      el('li', { className: 'status-row', dataset: { health: r.state } },
        el('span', { className: 'status-dot', 'aria-hidden': 'true' }),
        el('span', { className: 'status-label', text: label }),
        el('span', { className: 'status-value', text: r.value }))));
  }

  $('sys-mini').addEventListener('click', () => {
    closeNav();
    setTimeout(() => $('status-panel').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' }), 60);
  });

  // ── PWA: service worker, install, offline, update notice ────────────────
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function setupServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    let userAskedReload = false;

    navigator.serviceWorker.register('sw.js', { scope: '/' }).then((reg) => {
      const offer = (worker) => toast('Versiune nouă disponibilă', 'info', {
        icon: 'refresh',
        action: 'Reîncarcă',
        onAction: () => { userAskedReload = true; worker.postMessage('SKIP_WAITING'); }
      });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
        });
      });
      // Long-open installed apps: look for a new version when brought back to front
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((err) => console.warn('[PWA] Service worker neînregistrat:', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (userAskedReload) location.reload();
    });
  }

  function setupInstall() {
    const btn = $('install-btn');
    const pop = $('install-pop');
    let deferred = null;
    if (isStandalone()) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      btn.hidden = true;
      pop.hidden = true;
      deferred = null;
      toast('Aplicația a fost instalată');
    });
    if (isIOS) btn.hidden = false; // iOS has no install prompt → show instructions

    btn.addEventListener('click', async () => {
      if (deferred) {
        deferred.prompt();
        const { outcome } = await deferred.userChoice;
        deferred = null;
        if (outcome === 'accepted') btn.hidden = true;
        return;
      }
      const open = pop.hidden;
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !e.target.closest('.install-wrap')) closeInstallPop();
    });
  }

  function closeInstallPop() {
    $('install-pop').hidden = true;
    $('install-btn').setAttribute('aria-expanded', 'false');
  }

  function setupConnectivity() {
    const banner = $('offline-banner');
    const update = () => {
      const offline = !navigator.onLine;
      banner.classList.toggle('is-visible', offline);
      banner.setAttribute('aria-hidden', String(!offline));
    };
    window.addEventListener('offline', () => { update(); render(); });
    window.addEventListener('online', () => { update(); loadBriefing(); checkHealth(); });
    update();
  }

  // ── Theme switcher (theme.js has already set the theme before paint) ────
  function syncThemeButtons() {
    const current = window.cfTheme ? window.cfTheme.get() : 'light';
    document.querySelectorAll('[data-theme-choice]').forEach(btn =>
      btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === current)));
  }

  function setupTheme() {
    document.querySelectorAll('[data-theme-choice]').forEach(btn =>
      btn.addEventListener('click', () => window.cfTheme?.set(btn.dataset.themeChoice)));
    document.addEventListener('cf-themechange', syncThemeButtons); // also fires on OS change
    syncThemeButtons();
  }

  // ── Keyboard ────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('lost-dialog').open) return; // the <dialog> closes itself
      const openMenu = document.querySelector('.wa-menu:not([hidden])');
      if (openMenu) { closeWaMenu(); openMenu.previousElementSibling?.focus(); return; }
      if (state.orderDrawerId) closeOrder();
      else if (state.drawerId) closeDrawer();
      else if (!$('install-pop').hidden) closeInstallPop();
      else if (document.body.classList.contains('nav-open')) closeNav();
      else if (document.activeElement === searchInput) { clearSearch(); searchInput.blur(); }
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing && !state.drawerId && !state.orderDrawerId) {
      e.preventDefault();
      document.body.classList.add('search-open');
      searchInput.focus();
    }
  });

  // Keep "acum 5 minute" labels fresh
  setInterval(() => {
    const busy = state.drawerId || state.orderDrawerId || $('lost-dialog').open
      || document.activeElement?.closest?.('#board, #recent-list, #attention-list, #kpis, #orders-list');
    if (!busy) render();
  }, 60 * 1000);

  boot();
})();
