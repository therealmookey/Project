// ============================================================
// MODULES - Module rechten beheer (modules.html)
// ============================================================

console.log('🚀 modules.js wordt geladen...');

import { requireAdmin } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let alleGebruikers = [];
let alleModules = [];
let alleRechten = [];
let currentUserId = null;

// ===== DOM ELEMENTEN =====
const gebruikersModuleLijst = document.getElementById('gebruikersModuleLijst');
const modulesLijst = document.getElementById('modulesLijst');
const searchModuleUserInput = document.getElementById('searchModuleUserInput');
const clearModuleUserSearchBtn = document.getElementById('clearModuleUserSearchBtn');
const modulePopup = document.getElementById('modulePopup');
const modulePopupTitle = document.getElementById('modulePopupTitle');
const modulePopupUser = document.getElementById('modulePopupUser');
const moduleCheckboxes = document.getElementById('moduleCheckboxes');
const saveModuleRightsBtn = document.getElementById('saveModuleRightsBtn');
const closeModulePopup = document.getElementById('closeModulePopup');

console.log('✅ DOM elementen gevonden');

// ===== MODULES LADEN =====
async function laadModules() {
    try {
        const { data, error } = await supabase
            .from('modules')
            .select('*')
            .order('module_naam');
        
        if (error) throw error;
        
        alleModules = data || [];
        console.log('📋 Alle modules geladen:', alleModules.length);
        
        toonModules(alleModules);
    } catch (err) {
        console.error('Fout bij laden modules:', err);
        showToast('Fout bij laden modules: ' + err.message, 'error');
    }
}

// ===== MODULES TONEN (ALLE MODULES OVERZICHT) =====
function toonModules(modules) {
    if (!modulesLijst) return;
    
    if (!modules || modules.length === 0) {
        modulesLijst.innerHTML = '<p>Geen modules gevonden.</p>';
        return;
    }
    
    // Tel hoeveel gebruikers per module rechten hebben
    const moduleCounts = {};
    modules.forEach(module => {
        moduleCounts[module.module_sleutel] = 0;
    });
    
    alleRechten.forEach(recht => {
        if (moduleCounts[recht.module_sleutel] !== undefined) {
            moduleCounts[recht.module_sleutel]++;
        }
    });
    
    let html = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Module</th>
                        <th>Sleutel</th>
                        <th>Beschrijving</th>
                        <th>Standaard aan</th>
                        <th>Gebruikers met recht</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    modules.forEach(module => {
        const standaardStatus = module.standaard_aan ? '✅ Ja' : '❌ Nee';
        const count = moduleCounts[module.module_sleutel] || 0;
        html += `
            <tr>
                <td><strong>${escapeHtml(module.module_naam)}</strong></td>
                <td><code>${escapeHtml(module.module_sleutel)}</code></td>
                <td>${escapeHtml(module.beschrijving || '-')}</td>
                <td>${standaardStatus}</td>
                <td style="text-align: center;">${count}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            <div style="margin-top: 10px; font-size: 0.85rem; color: #6c757d;">
                Totaal: ${modules.length} modules
            </div>
        </div>
    `;
    
    modulesLijst.innerHTML = html;
}

// ===== GEBRUIKERS LADEN (MET RECHTEN) =====
async function laadGebruikersMetRechten() {
    if (!gebruikersModuleLijst) return;
    
    gebruikersModuleLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        // Haal alle gebruikers op
        const { data: gebruikers, error: userError } = await supabase
            .from('gebruikers_rollen')
            .select('*')
            .order('gebruikersnaam');
        
        if (userError) throw userError;
        
        // Haal alle module rechten op
        const { data: rechten, error: rechtError } = await supabase
            .from('gebruikers_module_rechten')
            .select('*');
        
        if (rechtError) throw rechtError;
        
        alleGebruikers = gebruikers || [];
        alleRechten = rechten || [];
        
        console.log('📋 Gebruikers geladen:', alleGebruikers.length);
        console.log('📋 Rechten geladen:', alleRechten.length);
        
        toonGebruikersMetRechten(alleGebruikers);
    } catch (err) {
        console.error('Fout bij laden gebruikers:', err);
        gebruikersModuleLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== GEBRUIKERS TONEN MET RECHTEN =====
function toonGebruikersMetRechten(gebruikers) {
    if (!gebruikersModuleLijst) return;
    
    let filteredData = gebruikers;
    
    // Zoekfilter
    if (searchModuleUserInput && searchModuleUserInput.value) {
        const term = searchModuleUserInput.value.toLowerCase();
        filteredData = gebruikers.filter(user => 
            (user.gebruikersnaam && user.gebruikersnaam.toLowerCase().includes(term)) ||
            (user.user_id && user.user_id.toLowerCase().includes(term))
        );
    }
    
    if (!filteredData || filteredData.length === 0) {
        gebruikersModuleLijst.innerHTML = '<p>Geen gebruikers gevonden.</p>';
        return;
    }
    
    let html = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Gebruikersnaam</th>
                        <th>Rol</th>
                        <th>Status</th>
                        <th>Module rechten</th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    filteredData.forEach(user => {
        // Haal de rechten voor deze gebruiker op
        const userRechten = alleRechten.filter(r => r.user_id === user.user_id);
        
        // Toon welke modules actief zijn
        let rechtenLabels = [];
        if (user.rol === 'admin') {
            rechtenLabels = ['👑 Alle modules (admin)'];
        } else {
            alleModules.forEach(module => {
                const recht = userRechten.find(r => r.module_sleutel === module.module_sleutel);
                const isActive = recht ? recht.actief : module.standaard_aan;
                if (isActive) {
                    rechtenLabels.push(module.module_naam);
                }
            });
            if (rechtenLabels.length === 0) {
                rechtenLabels = ['❌ Geen rechten'];
            }
        }
        
        const statusLabel = user.status === 'goedgekeurd' ? '✅ Actief' : 
                           (user.status === 'wachtend' ? '⏳ Wachtend' : '❌ Geweigerd');
        
        html += `
            <tr>
                <td><strong>${escapeHtml(user.gebruikersnaam || 'Onbekend')}</strong></td>
                <td>${user.rol === 'admin' ? '👑 Admin' : '👤 Gebruiker'}</td>
                <td>${statusLabel}</td>
                <td style="font-size:0.85rem; max-width: 300px;">
                    ${rechtenLabels.length > 3 ? rechtenLabels.slice(0, 3).join(', ') + ` +${rechtenLabels.length - 3} meer` : rechtenLabels.join(', ')}
                </td>
                <td>
                    ${user.rol !== 'admin' ? `<button class="btn btn-primary edit-rights-btn" data-userid="${user.user_id}">🔑 Rechten</button>` : '<span style="color:#6c757d;">Admin</span>'}
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    gebruikersModuleLijst.innerHTML = html;
    
    // Event listeners voor rechten bewerken
    document.querySelectorAll('.edit-rights-btn').forEach(btn => {
        btn.addEventListener('click', () => openModulePopup(btn.dataset.userid));
    });
}

// ===== MODULE POPUP =====
async function openModulePopup(userId) {
    try {
        // Haal gebruiker info op
        const { data: user, error: userError } = await supabase
            .from('gebruikers_rollen')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (userError) throw userError;
        
        currentUserId = userId;
        modulePopupTitle.textContent = 'Module rechten bewerken';
        modulePopupUser.textContent = user.gebruikersnaam || 'Onbekend';
        
        // Haal alle modules op
        const { data: modules, error: modError } = await supabase
            .from('modules')
            .select('*')
            .order('module_naam');
        
        if (modError) throw modError;
        
        // Haal bestaande rechten op
        const { data: rechten, error: rechtError } = await supabase
            .from('gebruikers_module_rechten')
            .select('*')
            .eq('user_id', userId);
        
        if (rechtError) throw rechtError;
        
        const rechtenMap = {};
        rechten.forEach(r => {
            rechtenMap[r.module_sleutel] = r.actief;
        });
        
        let html = '';
        modules.forEach(module => {
            const isActive = rechtenMap[module.module_sleutel] !== undefined ? 
                rechtenMap[module.module_sleutel] : module.standaard_aan;
            const checked = isActive ? 'checked' : '';
            html += `
                <div class="module-checkbox-item">
                    <label>
                        <input type="checkbox" class="module-recht-checkbox" 
                               data-module="${module.module_sleutel}" ${checked}>
                        <strong>${escapeHtml(module.module_naam)}</strong>
                        ${module.beschrijving ? `<span style="color:#6c757d;font-size:0.85rem;display:block;margin-left:28px;">${escapeHtml(module.beschrijving)}</span>` : ''}
                    </label>
                </div>
            `;
        });
        
        moduleCheckboxes.innerHTML = html;
        modulePopup.style.display = 'flex';
        
    } catch (err) {
        console.error('Fout bij openen popup:', err);
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== MODULE RECHTEN OPSLAAN =====
async function saveModuleRights() {
    if (!currentUserId) {
        showToast('❌ Geen gebruiker geselecteerd', 'error');
        return;
    }
    
    try {
        const checkboxes = document.querySelectorAll('.module-recht-checkbox');
        const updates = [];
        
        checkboxes.forEach(checkbox => {
            const moduleSleutel = checkbox.dataset.module;
            const actief = checkbox.checked;
            updates.push({
                user_id: currentUserId,
                module_sleutel: moduleSleutel,
                actief: actief
            });
        });
        
        // Verwijder alle bestaande rechten voor deze gebruiker
        await supabase
            .from('gebruikers_module_rechten')
            .delete()
            .eq('user_id', currentUserId);
        
        // Voeg nieuwe rechten toe
        for (const update of updates) {
            await supabase
                .from('gebruikers_module_rechten')
                .insert([update]);
        }
        
        // Update de lokale rechten
        const existingRechten = alleRechten.filter(r => r.user_id !== currentUserId);
        const newRechtenData = updates.map(u => ({
            user_id: currentUserId,
            module_sleutel: u.module_sleutel,
            actief: u.actief
        }));
        alleRechten = [...existingRechten, ...newRechtenData];
        
        // Herlaad ook de modules lijst om de aantallen bij te werken
        toonModules(alleModules);
        
        showToast('✅ Module rechten opgeslagen!', 'success');
        modulePopup.style.display = 'none';
        
        // Herlaad de gebruikerslijst
        laadGebruikersMetRechten();
        
    } catch (err) {
        console.error('Fout bij opslaan rechten:', err);
        showToast('❌ Fout bij opslaan rechten: ' + err.message, 'error');
    }
}

// ===== FILTER RESET =====
function resetUserFilter() {
    if (searchModuleUserInput) searchModuleUserInput.value = '';
    laadGebruikersMetRechten();
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Modules pagina initialiseren...');
    
    // Controleer of gebruiker admin is
    const isAdmin = await requireAdmin('dashboard.html');
    if (!isAdmin) {
        console.warn('⚠️ Geen admin toegang, redirect...');
        return;
    }
    console.log('✅ Admin toegang verleend');
    
    // Laad data
    await laadModules();
    await laadGebruikersMetRechten();
    
    // ===== EVENT LISTENERS =====
    
    // Zoekfunctionaliteit
    if (searchModuleUserInput) {
        searchModuleUserInput.addEventListener('input', () => {
            laadGebruikersMetRechten();
        });
    }
    
    if (clearModuleUserSearchBtn) {
        clearModuleUserSearchBtn.addEventListener('click', resetUserFilter);
    }
    
    // Opslaan rechten
    if (saveModuleRightsBtn) {
        saveModuleRightsBtn.addEventListener('click', saveModuleRights);
    }
    
    // Sluiten popup
    if (closeModulePopup) {
        closeModulePopup.addEventListener('click', () => {
            modulePopup.style.display = 'none';
        });
    }
    
    // Sluiten bij klik buiten popup
    window.addEventListener('click', (e) => {
        if (e.target === modulePopup) {
            modulePopup.style.display = 'none';
        }
    });
    
    console.log('✅ Modules pagina geïnitialiseerd!');
});

console.log('✅ modules.js geladen!');