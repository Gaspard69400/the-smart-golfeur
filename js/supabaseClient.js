/* ════════════════════════════════════════════
 * THE SMART GOLFER — supabaseClient.js
 * Initialise le client Supabase (window.sbClient).
 * Si la librairie CDN n'est pas chargée, sbClient = null
 * et l'app retombe automatiquement en mode démo (local).
 * ════════════════════════════════════════════ */
window.sbClient = null;
try {
  if (window.supabase && window.SB_URL && window.SB_KEY) {
    window.sbClient = window.supabase.createClient(window.SB_URL, window.SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tsg_sb_auth' }
    });
  } else {
    console.warn('[TSG] Supabase non disponible — mode démo local uniquement.');
  }
} catch (e) {
  console.warn('[TSG] Erreur init Supabase:', e.message);
}
