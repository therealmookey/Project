// ===== GEMEENSCHAPPELIJKE FUNCTIES =====

console.log('main.js geladen');

// ===== IMPORTS =====
import { laadNavigatie, checkPageAuth } from './core/navigation.js';
import { initTheme } from './core/theme.js';
import { addVersionBadge } from './core/version.js';

// ===== DASHBOARD FUNCTIES (blijven hier) =====

// Laad dashboard statistieken (als die er zijn)
async function laadDashboardStatistieken() {
    if (!window.supabase) return;
    
    try {
        // Aantal adressen
        const { count: adresCount } = await window.supabase
            .from('adressen')
            .select('*', { count: 'exact', head: true });
        
        // Aantal planningen vandaag
        const vandaag = new Date().toISOString().split('T')[0];
        const { count: planningCount } = await window.supabase
            .from('planningen')
            .select('*', { count: 'exact', head: true })
            .eq('datum', vandaag);
        
        // Update dashboard elementen als ze bestaan
        const adresCountEl = document.getElementById('dashboardAdresCount');
        const planningCountEl = document.getElementById('dashboardPlanningCount');
        if (adresCountEl) adresCountEl.textContent = adresCount || 0;
        if (planningCountEl) planningCountEl.textContent = planningCount || 0;
        
    } catch (err) {
        console.error('Fout bij laden dashboard statistieken:', err);
    }
}

// ===== INITIALISATIE =====

// Wacht tot de DOM volledig geladen is
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // Auth check
        checkPageAuth();
        
        // Navigatie laden
        if (document.getElementById('navigatie-placeholder')) {
            laadNavigatie();
        }
        
        // Thema initialiseren
        initTheme();
        
        // Versie badge
        addVersionBadge();
        
        // Dashboard statistieken (als op dashboard pagina)
        if (document.getElementById('dashboardAdresCount') || document.getElementById('dashboardPlanningCount')) {
            laadDashboardStatistieken();
        }
    });
} else {
    // DOM is al geladen
    setTimeout(function() {
        checkPageAuth();
        
        if (document.getElementById('navigatie-placeholder')) {
            laadNavigatie();
        }
        
        initTheme();
        addVersionBadge();
        
        if (document.getElementById('dashboardAdresCount') || document.getElementById('dashboardPlanningCount')) {
            laadDashboardStatistieken();
        }
    }, 50);
}