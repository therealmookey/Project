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
    'stock.html'
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
    if (typeof window.supabase === 'undefined') {
        return false;
    }
    
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

// ===== INITIALISATIE =====

// Controleer authenticatie bij het laden van de pagina
document.addEventListener('DOMContentLoaded', function() {
    checkPageAuth();
    
    if (document.getElementById('navigatie-placeholder')) {
        laadNavigatie();
    }
});

// Dashboard statistieken
if (document.getElementById('dashboardAdresCount') || document.getElementById('dashboardPlanningCount')) {
    document.addEventListener('DOMContentLoaded', laadDashboardStatistieken);
}