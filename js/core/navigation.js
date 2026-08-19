// ============================================================
// CORE - NAVIGATION (Menu en navigatie beheer)
// ============================================================

import { supabase, getCurrentUser } from './supabase.js';

// ===== CONSTANTEN =====
const BESCHERMDE_PAGINAS = [
    'dashboard.html',
    'adressen.html',
    'planning.html',
    'admin.html',
    'modules.html',
    'profiel.html',
    'registraties.html',
    'stock.html',
    'analytics.html',
    'tracker-dashboard.html'
];

// ===== MODULE RECHTEN (CACHE) =====
let moduleRightsCache = null;
let moduleRightsCacheTime = 0;
const CACHE_TTL = 60000; // 60 seconden

// ===== PAGINA BEVEILIGING =====

export function isBeschermdePagina() {
    const huidigePagina = window.location.pathname.split('/').pop();
    return BESCHERMDE_PAGINAS.includes(huidigePagina);
}

export async function checkPageAuth() {
    if (!isBeschermdePagina()) return;
    
    if (!supabase) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        const { data: userData, error } = await supabase
            .from('gebruikers_rollen')
            .select('status')
            .eq('user_id', session.user.id)
            .single();
        
        if (error || !userData || userData.status !== 'goedgekeurd') {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        }
        
    } catch (err) {
        console.error('Auth check error:', err);
        window.location.href = 'index.html';
    }
}

// ===== MODULE RECHTEN =====

export async function heeftModuleToegang(moduleSleutel) {
    if (!supabase) return false;
    
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        
        const now = Date.now();
        if (moduleRightsCache && (now - moduleRightsCacheTime) < CACHE_TTL) {
            return moduleRightsCache[moduleSleutel] || false;
        }
        
        const { data: rollen } = await supabase
            .from('gebruikers_rollen')
            .select('rol')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (rollen && rollen.rol === 'admin') {
            moduleRightsCache = {};
            ['adressen', 'planning', 'registraties', 'stock', 'admin', 'analytics', 'modules', 'tracker'].forEach(key => {
                moduleRightsCache[key] = true;
            });
            moduleRightsCacheTime = now;
            return true;
        }
        
        const { data: rechten, error } = await supabase
            .from('gebruikers_module_rechten')
            .select('module_sleutel, actief')
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Fout bij check module rechten:', error);
            return false;
        }
        
        moduleRightsCache = {};
        rechten.forEach(r => {
            moduleRightsCache[r.module_sleutel] = r.actief;
        });
        moduleRightsCacheTime = now;
        
        if (moduleRightsCache[moduleSleutel] !== undefined) {
            return moduleRightsCache[moduleSleutel];
        }
        
        const { data: module, error: modError } = await supabase
            .from('modules')
            .select('standaard_aan')
            .eq('module_sleutel', moduleSleutel)
            .maybeSingle();
        
        if (modError) {
            console.error('Fout bij check module standaard:', modError);
            return false;
        }
        
        return module ? module.standaard_aan : false;
        
    } catch (err) {
        console.error('Exception bij module check:', err);
        return false;
    }
}

// ===== FILTER NAVIGATIE MODULES =====
export async function filterNavigatieModules() {
    try {
        const moduleLinks = document.querySelectorAll('.module-link');
        
        console.log(`🔍 ${moduleLinks.length} module links gevonden`);
        
        // Eerst alle links verbergen (verwijder visible klasse)
        moduleLinks.forEach(link => {
            link.classList.remove('visible');
        });
        
        // Dan per link checken of de gebruiker toegang heeft
        for (const link of moduleLinks) {
            const moduleSleutel = link.dataset.module;
            if (!moduleSleutel) continue;
            
            const heeftToegang = await heeftModuleToegang(moduleSleutel);
            if (heeftToegang) {
                link.classList.add('visible');
                console.log(`✅ Module zichtbaar: ${moduleSleutel}`);
            } else {
                console.log(`🔒 Module verborgen: ${moduleSleutel}`);
            }
        }
    } catch (err) {
        console.error('Fout bij filteren navigatie modules:', err);
    }
}

// ===== NAVIGATIE LADEN =====

export async function laadNavigatie() {
    const placeholder = document.getElementById('navigatie-placeholder');
    if (!placeholder) return;
    
    try {
        const response = await fetch('includes/navigatie.html');
        if (!response.ok) throw new Error('Navigatie kon niet geladen worden');
        const html = await response.text();
        placeholder.innerHTML = html;
        
        // Filter modules op rechten
        await filterNavigatieModules();
        
        // Uitlog knop
        const logoutBtn = document.getElementById('logoutBtnNav');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (supabase) await supabase.auth.signOut();
                window.location.href = 'index.html';
            });
        }
        
        console.log('✅ Navigatie geladen en gefilterd!');
        
    } catch (error) {
        console.error('Fout bij laden navigatie:', error);
        placeholder.innerHTML = '<nav style="background:#2c7da0; padding:10px; color:white;">Menu laden mislukt</nav>';
    }
}

// ===== AUTH HELPERS =====

export async function checkAuth() {
    if (!supabase) return false;
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    } catch (err) {
        console.error('Auth check error:', err);
        return false;
    }
}

// ===== EXPORT =====
export default {
    isBeschermdePagina,
    checkPageAuth,
    heeftModuleToegang,
    filterNavigatieModules,
    laadNavigatie,
    checkAuth
};