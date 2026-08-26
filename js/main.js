// ============================================================
// MAIN - Hoofdscript voor alle pagina's
// ============================================================
console.log('📦 main.js geladen');

import { initTheme } from './core/theme.js';
import { laadNavigatie } from './core/navigation.js';
import { addVersionBadge } from './core/version.js';
import { supabase } from './core/supabase.js';

// ===== STATE =====
let isNavigatieGeladen = false;

// ===== INITIALISATIE =====
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔄 Applicatie initialiseren...');

  // 1. Laad navigatie (alleen de eerste keer)
  if (!isNavigatieGeladen) {
    await laadNavigatie();
    isNavigatieGeladen = true;
    console.log('✅ Navigatie geladen (eerste keer)');
  } else {
    console.log('✅ Navigatie reeds geladen, overslaan...');
  }

  // 2. Versie badge toevoegen
  addVersionBadge();

  // 3. Auth check
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.log('✅ Gebruiker is ingelogd:', session.user.email);
  }

  console.log('✅ main.js geladen en klaar voor gebruik');
});

// Als DOM al geladen is
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('🔄 DOM al geladen, start main direct...');
  document.dispatchEvent(new Event('DOMContentLoaded'));
}