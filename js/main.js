// ============================================================
// MAIN - Hoofdbestand (wordt op alle pagina's geladen)
// ============================================================

import { laadNavigatie } from './core/navigation.js';
import { initTheme } from './core/theme.js';
import { addVersionBadge } from './core/version.js';
import { requireAuth } from './core/auth.js';

console.log('main.js geladen');

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', function() {
    // Alleen auth check voor beschermde pagina's (wordt ook in dashboard.js gedaan)
    // We laten de navigatie wel laden, ongeacht auth status
    
    if (document.getElementById('navigatie-placeholder')) {
        laadNavigatie();
    }
    
    // Thema initialiseren
    initTheme();
    
    // Versie badge
    addVersionBadge();
});

// Als de DOM al geladen is
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (document.getElementById('navigatie-placeholder')) {
        laadNavigatie();
    }
    initTheme();
    addVersionBadge();
}