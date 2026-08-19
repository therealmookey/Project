// ============================================================
// MAIN - Hoofdbestand (wordt op alle pagina's geladen)
// ============================================================

// Importeer core modules
import { laadNavigatie, checkPageAuth, filterNavigatieModules } from './core/navigation.js';
import { initTheme } from './core/theme.js';
import { addVersionBadge } from './core/version.js';

console.log('📦 main.js geladen');

// ===== SNEL START: Toon pagina direct =====
// Verberg alle modules eerst (voorkom flits)
document.addEventListener('DOMContentLoaded', function() {
    // 1. Thema direct toepassen (geen flits)
    initTheme();
    
    // 2. Versie badge (altijd zichtbaar)
    addVersionBadge();
    
    // 3. Navigatie laden (asynchroon)
    if (document.getElementById('navigatie-placeholder')) {
        laadNavigatie().then(() => {
            // Na laden van navigatie: filter modules op rechten
            filterNavigatieModules();
        });
    }
    
    // 4. Auth check (asynchroon, niet blokkerend)
    checkPageAuth();
    
    console.log('✅ main.js init voltooid');
});

// Als DOM al geladen is, voer direct uit
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initTheme();
    addVersionBadge();
    if (document.getElementById('navigatie-placeholder')) {
        laadNavigatie().then(() => {
            filterNavigatieModules();
        });
    }
    checkPageAuth();
}