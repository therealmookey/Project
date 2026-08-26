// ============================================================
// MAIN - Hoofdscript voor alle pagina's
// ============================================================
console.log('📦 main.js geladen');

import { initTheme } from './core/theme.js';
import { laadNavigatie } from './core/navigation.js';
import { addVersionBadge } from './core/version.js';
import { supabase } from './core/supabase.js';

// ===== GLOBALE STATE (blijft bestaan over pagina's heen) =====
if (typeof window.__appInitialized === 'undefined') {
    window.__appInitialized = false;
}

// ===== INITIALISATIE =====
document.addEventListener('DOMContentLoaded', async function() {
  // 🔥 Voorkom dubbele initialisatie met globale variabele
  if (window.__appInitialized) {
    console.log('⚠️ App al geïnitialiseerd, overslaan...');
    return;
  }
  window.__appInitialized = true;

  console.log('🔄 Applicatie initialiseren...');

  // 1. Thema initialiseren
  initTheme();

  // 2. Navigatie laden (alleen de eerste keer)
  await laadNavigatie();
  console.log('✅ Navigatie geladen');

  // 3. Versie badge toevoegen
  addVersionBadge();

  // 4. Auth check
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.log('✅ Gebruiker is ingelogd:', session.user.email);
  }

  console.log('✅ main.js geladen en klaar voor gebruik');
});

// Als DOM al geladen is
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  if (!window.__appInitialized) {
    console.log('🔄 DOM al geladen, start main direct...');
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
}