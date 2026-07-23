// ============================================================
// ANALYTICS - Analytics pagina (analytics.html)
// ============================================================

console.log('🚀 analytics.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml, formatDate } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== DOM ELEMENTEN =====
const kpiTotaalOphalingen = document.getElementById('kpiTotaalOphalingen');
const kpiTotaalGewicht = document.getElementById('kpiTotaalGewicht');
const kpiGemiddeldGewicht = document.getElementById('kpiGemiddeldGewicht');
const kpiZiekenhuizen = document.getElementById('kpiZiekenhuizen');
const kpiRittenWeek = document.getElementById('kpiRittenWeek');
const kpiOpstartenMaand = document.getElementById('kpiOpstartenMaand');

console.log('✅ DOM elementen gevonden');

// ===== MODULE 1: KPI DASHBOARD =====
async function laadKPI() {
    console.log('📊 KPI dashboard laden...');
    
    try {
        // Query 1: Totaal ophalingen
        console.log('🔍 Query 1: Totaal ophalingen');
        const { count: totaalOphalingen, error: err1 } = await supabase
            .from('ophaalregistraties')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'ophaling');
        
        if (err1) {
            console.error('❌ Fout bij totaal ophalingen:', err1);
        } else {
            console.log('✅ Totaal ophalingen:', totaalOphalingen);
            if (kpiTotaalOphalingen) kpiTotaalOphalingen.textContent = totaalOphalingen || 0;
        }

        // Query 2: Totaal gewicht
        console.log('🔍 Query 2: Totaal gewicht');
        const { data: gewichtData, error: err2 } = await supabase
            .from('ophaalregistraties')
            .select('gewicht')
            .eq('type', 'ophaling');
        
        if (err2) {
            console.error('❌ Fout bij totaal gewicht:', err2);
        } else {
            const totaalGewicht = gewichtData?.reduce((sum, r) => sum + (r.gewicht || 0), 0) || 0;
            console.log('✅ Totaal gewicht:', totaalGewicht);
            if (kpiTotaalGewicht) kpiTotaalGewicht.textContent = totaalGewicht.toFixed(0);
            
            const gemiddeldGewicht = totaalOphalingen > 0 ? totaalGewicht / totaalOphalingen : 0;
            console.log('✅ Gemiddeld gewicht:', gemiddeldGewicht);
            if (kpiGemiddeldGewicht) kpiGemiddeldGewicht.textContent = gemiddeldGewicht.toFixed(1);
        }

        // Query 3: Actieve ziekenhuizen
        console.log('🔍 Query 3: Actieve ziekenhuizen');
        const { count: ziekenhuizen, error: err3 } = await supabase
            .from('adressen')
            .select('*', { count: 'exact', head: true });
        
        if (err3) {
            console.error('❌ Fout bij ziekenhuizen:', err3);
        } else {
            console.log('✅ Actieve ziekenhuizen:', ziekenhuizen);
            if (kpiZiekenhuizen) kpiZiekenhuizen.textContent = ziekenhuizen || 0;
        }

        // Query 4: Ritten deze week
        console.log('🔍 Query 4: Ritten deze week');
        const vandaag = new Date();
        const weekStart = new Date(vandaag);
        weekStart.setDate(vandaag.getDate() - vandaag.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEind = new Date(weekStart);
        weekEind.setDate(weekStart.getDate() + 7);
        const weekEindStr = weekEind.toISOString().split('T')[0];
        
        console.log('📅 Week range:', weekStartStr, 'tot', weekEindStr);
        
        const { count: rittenWeek, error: err4 } = await supabase
            .from('planningen')
            .select('*', { count: 'exact', head: true })
            .gte('datum', weekStartStr)
            .lt('datum', weekEindStr);
        
        if (err4) {
            console.error('❌ Fout bij ritten deze week:', err4);
        } else {
            console.log('✅ Ritten deze week:', rittenWeek);
            if (kpiRittenWeek) kpiRittenWeek.textContent = rittenWeek || 0;
        }

        // Query 5: Opstarten deze maand
        console.log('🔍 Query 5: Opstarten deze maand');
        const maandStart = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
        const maandStartStr = maandStart.toISOString().split('T')[0];
        const maandEind = new Date(vandaag.getFullYear(), vandaag.getMonth() + 1, 0);
        const maandEindStr = maandEind.toISOString().split('T')[0];
        
        console.log('📅 Maand range:', maandStartStr, 'tot', maandEindStr);
        
        const { count: opstartenMaand, error: err5 } = await supabase
            .from('ophaalregistraties')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'opstart')
            .gte('registratiedatum', maandStartStr)
            .lte('registratiedatum', maandEindStr);
        
        if (err5) {
            console.error('❌ Fout bij opstarten deze maand:', err5);
        } else {
            console.log('✅ Opstarten deze maand:', opstartenMaand);
            if (kpiOpstartenMaand) kpiOpstartenMaand.textContent = opstartenMaand || 0;
        }
        
        console.log('✅ KPI dashboard geladen');
    } catch (err) {
        console.error('❌ Fout bij laden KPI:', err);
    }
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Analytics pagina initialiseren...');
    
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    // Alleen KPI laden (andere modules komen later)
    await laadKPI();
    
    console.log('✅ Analytics pagina geïnitialiseerd (KPI alleen)');
});

console.log('✅ analytics.js geladen!');