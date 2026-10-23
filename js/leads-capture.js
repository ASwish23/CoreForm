// ── Lead capture → Supabase `leads` table (Mini-CRM) ───────────────────────
// Requires supabase-js + config.js to be loaded first.
// Fire-and-forget: a failure is logged but never blocks the visitor.
(function () {
  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'cf-leads-capture' }
    });
    return client;
  }

  function clean(value, max) {
    if (value == null) return null;
    const s = String(value).trim();
    return s ? s.slice(0, max) : null;
  }

  window.saveLead = async function (lead) {
    const sb = getClient();
    if (!sb) {
      console.warn('[Leads] Supabase indisponibil — lead-ul nu a fost salvat.');
      return false;
    }
    const row = {
      name:    clean(lead.name, 200) || 'Fără nume',
      email:   clean(lead.email, 200),
      phone:   clean(lead.phone, 50),
      company: clean(lead.company, 200),
      source:  lead.source,
      service: clean(lead.service, 500),
      message: clean(lead.message, 5000),
      // Where the visitor came from (attribution.js); the database derives the channel
      attribution: window.cfAttribution?.get() ?? null
    };
    try {
      let { error } = await sb.from('leads').insert(row);
      // Database not migrated yet (no attribution column) → never lose the lead
      if (error && row.attribution && /attribution/.test(error.message || '')) {
        delete row.attribution;
        ({ error } = await sb.from('leads').insert(row));
      }
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[Leads] Eroare la salvarea lead-ului:', err);
      return false;
    }
  };
})();
