// ============================================================
// MAIN - Hoofdbestand (wordt op alle pagina's geladen)
// ============================================================

// Importeer core modules
import { laadNavigatie, checkPageAuth } from './core/navigation.js';
import { initTheme } from './core/theme.js';
import { addVersionBadge } from './core/version.js';

console.log('📦 main.js geladen');

// ===== FUNCTIE: Alles initialiseren =====
function initializeApp() {
    console.log('🔄 Applicatie initialiseren...');
    
    // 1. Navigatie laden (eerst, zodat de checkbox bestaat)
    if (document.getElementById('navigatie-placeholder')) {
        laadNavigatie();
        console.log('✅ Navigatie geladen');
    }
    
    // 2. Thema initialiseren (na navigatie, zodat checkbox bestaat)
    setTimeout(() => {
        initTheme();
        console.log('✅ Thema geïnitialiseerd');
    }, 100);
    
    // 3. Versie badge toevoegen
    addVersionBadge();
    console.log('✅ Versie badge toegevoegd');
    
    // 4. Auth check (alleen voor beschermde pagina's)
    checkPageAuth();
    console.log('✅ Auth check uitgevoerd');
}

// ===== INITIALISATIE BIJ PAGINA LADEN =====

// Wacht tot de DOM klaar is
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is al geladen
    initializeApp();
}

// Ook bij volledige pagina load (voor de zekerheid)
window.addEventListener('load', function() {
    // Controleer of alles is geïnitialiseerd
    if (!document.documentElement.hasAttribute('data-theme')) {
        console.warn('⚠️ Thema niet geïnitialiseerd bij load, opnieuw proberen...');
        initTheme();
    }
});

console.log('✅ main.js geladen en klaar voor gebruik');