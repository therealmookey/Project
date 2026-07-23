// ===== GEMEENSCHAPPELIJKE FUNCTIES =====

console.log('main.js geladen');

// ===== PAGINA BEVEILIGING =====

// Lijst van pagina's die beschermd moeten worden
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

// Check of de huidige pagina beschermd is
function isBeschermdePagina() {
    const huidigePagina = window.location.pathname.split('/').pop();
    return BESCHERMDE_PAGINAS.includes(huidigePagina);
}

// Redirect naar login als niet ingelogd
async function checkPageAuth() {
    if (!isBeschermdePagina()) return;
    
    if (typeof window.supabase === 'undefined') {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        // Check ook of de gebruiker is goedgekeurd
        const { data: userData, error } = await window.supabase
            .from('gebruikers_rollen')
            .select('status')
            .eq('user_id', session.user.id)
            .single();
        
        if (error || !userData || userData.status !== 'goedgekeurd') {
            await window.supabase.auth.signOut();
            window.location.href = 'index.html';
        }
        
    } catch (err) {
        console.error('Auth check error:', err);
        window.location.href = 'index.html';
    }
}

// ===== DARK MODE FUNCTIES (FALLBACK) =====
// Deze functies worden alleen gebruikt als de theme module niet beschikbaar is
let themeModuleLoaded = false;

function loadThemePreferenceFallback() {
    if (themeModuleLoaded) return;
    const savedTheme = localStorage.getItem('theme');
    const checkbox = document.getElementById('themeCheckbox');
    
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (checkbox) checkbox.checked = true;
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (checkbox) checkbox.checked = false;
    }
}

function toggleThemeFallback(event) {
    if (themeModuleLoaded) return;
    const isChecked = event.target.checked;
    const newTheme = isChecked ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// ===== NAVIGATIE FUNCTIES =====

async function laadNavigatie() {
    const placeholder = document.getElementById('navigatie-placeholder');
    if (!placeholder) return;
    
    try {
        const response = await fetch('includes/navigatie.html');
        if (!response.ok) throw new Error('Navigatie kon niet geladen worden');
        const html = await response.text();
        placeholder.innerHTML = html;
        
        await filterNavigatieModules();
        
        // Dark mode slider event listener
        const themeCheckbox = document.getElementById('themeCheckbox');
        if (themeCheckbox) {
            // Gebruik de fallback toggle als de module niet is geladen
            themeCheckbox.addEventListener('change', function(e) {
                if (window.theme && window.theme.toggleTheme) {
                    window.theme.toggleTheme(e);
                } else {
                    toggleThemeFallback(e);
                }
            });
        }
        
        // Laad de opgeslagen thema voorkeur (fallback)
        loadThemePreferenceFallback();
        
        const logoutBtn = document.getElementById('logoutBtnNav');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (window.supabase) await window.supabase.auth.signOut();
                window.location.href = 'index.html';
            });
        }
        
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            const isAdmin = await heeftModuleToegang('admin');
            adminLink.style.display = isAdmin ? 'inline-block' : 'none';
        }
        
        const analyticsLink = document.getElementById('analyticsLink');
        if (analyticsLink) {
            const isAdmin = await heeftModuleToegang('admin');
            analyticsLink.style.display = isAdmin ? 'inline-block' : 'none';
        }
        
    } catch (error) {
        console.error('Fout bij laden navigatie:', error);
        placeholder.innerHTML = '<nav style="background:#2c7da0; padding:10px; color:white;">Menu laden mislukt</nav>';
    }
}

// ===== MODULE FUNCTIES =====

async function heeftModuleToegang(moduleSleutel) {
    if (!window.supabase) return false;
    
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) return false;
        
        const { data: rollen } = await window.supabase
            .from('gebruikers_rollen')
            .select('rol')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (rollen && rollen.rol === 'admin') return true;
        
        const { data: recht, error } = await window.supabase
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
        
        const { data: module, error: modError } = await window.supabase
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

async function filterNavigatieModules() {
    try {
        const navLinks = document.querySelectorAll('.nav-links a');
        for (const link of navLinks) {
            const href = link.getAttribute('href');
            if (!href) continue;
            if (href === 'dashboard.html' || href === 'profiel.html') continue;
            
            if (href === 'admin.html') {
                const isAdmin = await heeftModuleToegang('admin');
                link.style.display = isAdmin ? 'inline-block' : 'none';
                continue;
            }
            
            if (href === 'analytics.html') {
                const isAdmin = await heeftModuleToegang('admin');
                link.style.display = isAdmin ? 'inline-block' : 'none';
                continue;
            }
            
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

// ===== AUTH FUNCTIES =====

async function checkAuth() {
    if (typeof window.supabase === 'undefined') return false;
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
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

async function getCurrentUser() {
    if (typeof window.supabase === 'undefined') return null;
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        return user;
    } catch (err) {
        console.error('Fout bij ophalen gebruiker:', err);
        return null;
    }
}

async function isAdmin() {
    if (typeof window.supabase === 'undefined') return false;
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        
        const { data, error } = await window.supabase
            .from('gebruikers_rollen')
            .select('rol')
            .eq('user_id', user.id)
            .maybeSingle();
        
        if (error) {
            console.error('Admin check error:', error);
            return false;
        }
        return data && data.rol === 'admin';
    } catch (err) {
        console.error('Admin check exception:', err);
        return false;
    }
}

// ===== DASHBOARD FUNCTIES =====

async function laadDashboardStatistieken() {
    if (!window.supabase) return;
    try {
        const { count: adresCount } = await window.supabase
            .from('adressen')
            .select('*', { count: 'exact', head: true });
        
        const vandaag = new Date().toISOString().split('T')[0];
        const { count: planningCount } = await window.supabase
            .from('planningen')
            .select('*', { count: 'exact', head: true })
            .eq('datum', vandaag);
        
        const adresCountEl = document.getElementById('dashboardAdresCount');
        const planningCountEl = document.getElementById('dashboardPlanningCount');
        if (adresCountEl) adresCountEl.textContent = adresCount || 0;
        if (planningCountEl) planningCountEl.textContent = planningCount || 0;
    } catch (err) {
        console.error('Fout bij laden dashboard statistieken:', err);
    }
}

// ===== VERSIE BADGE =====
function addVersionBadgeDirect() {
    if (document.getElementById('version-badge')) return;
    if (localStorage.getItem('hideVersionBadge') === 'true') return;

    const badge = document.createElement('div');
    badge.id = 'version-badge';
    badge.innerHTML = `
        <span style="
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(44, 125, 160, 0.9);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-family: monospace;
            z-index: 9999;
            opacity: 0.7;
            transition: opacity 0.3s ease;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        "
        onmouseenter="this.style.opacity='1'"
        onmouseleave="this.style.opacity='0.7'"
        onclick="this.style.display='none'; localStorage.setItem('hideVersionBadge', 'true')"
        title="Klik om te verbergen">
            v2.0.0 
            <span style="font-size:9px; opacity:0.7;">${new Date().toISOString().replace('T', ' ').substring(5, 16)}</span>
            <span style="font-size:9px; background:rgba(255,255,255,0.2); padding:0 6px; border-radius:10px; margin-left:4px;">
                ⚡3/8
            </span>
        </span>
    `;
    document.body.appendChild(badge);
    console.log('✅ Versie-badge toegevoegd!');
}

function initBadge() {
    addVersionBadgeDirect();
    setTimeout(() => { if (!document.getElementById('version-badge')) addVersionBadgeDirect(); }, 500);
    setTimeout(() => { if (!document.getElementById('version-badge')) addVersionBadgeDirect(); }, 2000);
}

// ===== THEME MODULE LOADER =====
let themeInitDone = false;

async function loadThemeModule() {
    if (themeInitDone) return;
    
    try {
        const themeModule = await import('./core/theme.js');
        window.theme = themeModule;
        themeModuleLoaded = true;
        themeInitDone = true;
        console.log('✅ Theme module geladen!');
        
        if (themeModule.initTheme) {
            themeModule.initTheme();
        }
    } catch (err) {
        console.log('ℹ️ Theme module niet gevonden, gebruik fallback');
        themeModuleLoaded = false;
        themeInitDone = true;
        loadThemePreferenceFallback();
    }
}

// ===== INITIALISATIE =====

// Wacht tot de DOM volledig geladen is
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        checkPageAuth();
        if (document.getElementById('navigatie-placeholder')) {
            laadNavigatie();
        }
        if (!themeInitDone) loadThemeModule();
        initBadge();
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
        if (!themeInitDone) loadThemeModule();
        initBadge();
        if (document.getElementById('dashboardAdresCount') || document.getElementById('dashboardPlanningCount')) {
            laadDashboardStatistieken();
        }
    }, 50);
}