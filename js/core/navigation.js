// ============================================================
// CORE - NAVIGATION (Menu en navigatie beheer)
// ============================================================

import { supabase, getCurrentUser } from './supabase.js';
import { updateVersion } from './version.js';

// Update versie naar stap 4
updateVersion(4, 'Navigation Module', '2.2.0');

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
    'analytics.html'
];

// ===== PAGINA BEVEILIGING =====

/**
 * Check of de huidige pagina beschermd is
 * @returns {boolean}
 */
export function isBeschermdePagina() {
    const huidigePagina = window.location.pathname.split('/').pop();
    return BESCHERMDE_PAGINAS.includes(huidigePagina);
}

/**
 * Redirect naar login als niet ingelogd
 */
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
        
        // Check ook of de gebruiker is goedgekeurd
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

/**
 * Check of een gebruiker toegang heeft tot een module
 * @param {string} moduleSleutel 
 * @returns {Promise<boolean>}
 */
export async function heeftModuleToegang(moduleSleutel) {
    if (!supabase) return false;
    
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        
        // Check of gebruiker admin is
        const { data: rollen } = await supabase
            .from('gebruikers_rollen')
            .select('rol')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (rollen && rollen.rol === 'admin') return true;
        
        // Check specifiek module recht
        const { data: recht, error } = await supabase
            .from('gebruikers_module_rechten')
            .select('actief')
            .eq('user_id', user.id)
            .eq('module_sleutel', moduleSleutel)
            .maybeSingle();
        
        if (error) {
            console.error('Fout bij check module rechten:', error);
            return false;
        }
        
        if (recht) {
            return recht.actief === true;
        }
        
        // Check standaard waarde
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

/**
 * Filter navigatie links op basis van module rechten
 */
export async function filterNavigatieModules() {
    try {
        const navLinks = document.querySelectorAll('.nav-links a');
        for (const link of navLinks) {
            const href = link.getAttribute('href');
            if (!href) continue;
            
            // Altijd zichtbaar
            if (href === 'dashboard.html' || href === 'profiel.html') continue;
            
            // Admin link speciaal behandelen
            if (href === 'admin.html' || href === 'analytics.html') {
                const isAdmin = await heeftModuleToegang('admin');
                link.style.display = isAdmin ? 'inline-block' : 'none';
                continue;
            }
            
            // Bepaal module sleutel op basis van href
            let moduleSleutel = '';
            if (href.includes('adressen')) moduleSleutel = 'adressen';
            else if (href.includes('planning')) moduleSleutel = 'planning';
            else if (href.includes('modules')) moduleSleutel = 'modules';
            else if (href.includes('registraties')) moduleSleutel = 'registraties';
            else if (href.includes('stock')) moduleSleutel = 'stock';
            else continue;
            
            const heeftToegang = await heeftModuleToegang(moduleSleutel);
            link.style.display = heeftToegang ? 'inline-block' : 'none';
        }
    } catch (err) {
        console.error('Fout bij filteren navigatie modules:', err);
    }
}

// ===== NAVIGATIE LADEN =====

/**
 * Laad de navigatiebalk van een externe HTML file
 */
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
        
        console.log('✅ Navigatie geladen!');
        
    } catch (error) {
        console.error('Fout bij laden navigatie:', error);
        placeholder.innerHTML = '<nav style="background:#2c7da0; padding:10px; color:white;">Menu laden mislukt</nav>';
    }
}

// ===== AUTH HELPERS =====

/**
 * Check of gebruiker is ingelogd
 * @returns {Promise<boolean>}
 */
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