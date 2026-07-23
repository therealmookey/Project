// ============================================================
// DASHBOARD - Hoofdscript voor dashboard pagina
// ============================================================

// Importeer modules met absolute paden (vanuit de root)
import { laadAgenda, vorigeMaand, volgendeMaand, gaNaarVandaag } from '/js/modules/dashboard/agenda.js';
import { laadOphalingAnalyse, setCutoff } from '/js/modules/dashboard/voorspelling.js';

// ===== DASHBOARD AUTH =====

async function checkDashboardAuth() {
    if (typeof window.supabase === 'undefined') {
        console.error('Geen Supabase in dashboard');
        window.location.href = 'index.html';
        return;
    }

    const { data: { session }, error } = await window.supabase.auth.getSession();
    if (error || !session) {
        console.log('Geen sessie gevonden, terug naar login.');
        window.location.href = 'index.html';
    } else {
        console.log('Sessie is geldig voor:', session.user.email);
        toonGebruikersnaam(session.user.id);
        laadAgenda();
        laadOphalingAnalyse();
    }
}

function toonGebruikersnaam(userId) {
    const userEmailSpan = document.getElementById('userEmail');
    if (!userEmailSpan) return;

    window.supabase
        .from('gebruikers_rollen')
        .select('gebruikersnaam')
        .eq('user_id', userId)
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Fout bij ophalen gebruikersnaam:', error);
                userEmailSpan.textContent = 'Gebruiker';
                return;
            }
            userEmailSpan.textContent = data?.gebruikersnaam || 'Gebruiker';
        });
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', function() {
    checkDashboardAuth();

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