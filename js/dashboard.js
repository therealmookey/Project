// ============================================================
// DASHBOARD - Hoofdscript voor dashboard pagina
// ============================================================

import { requireAuth, toonGebruikersnaam } from './core/auth.js';
import { laadAgenda, vorigeMaand, volgendeMaand, gaNaarVandaag } from './modules/dashboard/agenda.js';
import { laadOphalingAnalyse, setCutoff } from './modules/dashboard/voorspelling.js';

console.log('🚀 dashboard.js geladen!');

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    // Controleer of gebruiker is ingelogd en goedgekeurd
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) return;

    // Toon gebruikersnaam
    toonGebruikersnaam(auth.user.id, 'userEmail');

    // Laad agenda en voorspellingen
    laadAgenda();
    laadOphalingAnalyse();

    // Agenda navigatie knoppen
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const todayBtn = document.getElementById('todayBtn');
    const statsBtn = document.getElementById('statsBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', vorigeMaand);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', volgendeMaand);
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', gaNaarVandaag);
    }

    if (statsBtn) {
        statsBtn.addEventListener('click', async function() {
            if (typeof window.supabase === 'undefined') {
                alert('Supabase is niet beschikbaar');
                return;
            }

            const { count: adresCount } = await window.supabase
                .from('adressen')
                .select('*', { count: 'exact', head: true });

            const { count: planningCount } = await window.supabase
                .from('planningen')
                .select('*', { count: 'exact', head: true });

            alert(`📊 Statistieken\n\n📍 Aantal adressen: ${adresCount || 0}\n📅 Aantal planningen: ${planningCount || 0}`);
        });
    }

    // Filter voor voorspellingen
    const filterSelect = document.getElementById('voorspellingFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            const days = parseInt(this.value);
            setCutoff(days);
        });
    }
});