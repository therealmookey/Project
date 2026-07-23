// ============================================================
// ADMIN - Admin panel (admin.html)
// ============================================================

import { requireAdmin, getGebruikersnaam, logoutUser } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('admin.js geladen');

// ===== DOM ELEMENTEN =====
const addUserBtn = document.getElementById('addUserBtn');
const userPopup = document.getElementById('userPopup');
const closeUserPopup = document.getElementById('closeUserPopup');
const saveUserBtn = document.getElementById('saveUserBtn');
const userPopupTitle = document.getElementById('userPopupTitle');
const userIsChauffeur = document.getElementById('userIsChauffeur');
const chauffeurVelden = document.getElementById('chauffeurVelden');
const gebruikersLijst = document.getElementById('gebruikersLijst');
const chauffeursLijst = document.getElementById('chauffeursLijst');
const searchUserInput = document.getElementById('searchUserInput');
const clearUserSearchBtn = document.getElementById('clearUserSearchBtn');
const searchChauffeurInput = document.getElementById('searchChauffeurInput');
const clearChauffeurSearchBtn = document.getElementById('clearChauffeurSearchBtn');
const aantalGebruikersSpan = document.getElementById('aantalGebruikers');
const aantalChauffeursSpan = document.getElementById('aantalChauffeurs');
const aantalAdressenSpan = document.getElementById('aantalAdressen');
const saveStartpuntBtn = document.getElementById('saveStartpuntBtn');
const startpuntInstelling = document.getElementById('startpuntInstelling');

// ===== STATE =====
let currentUserId = null;
let alleGebruikers = [];
let alleChauffeurs = [];
let huidigeUserZoekterm = '';
let huidigeChauffeurZoekterm = '';
let currentEditingUserId = null;

// ===== HULPFUNCTIES =====
function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

// ===== EDGE FUNCTION AANROEP =====
async function callAdminAction(action, data) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
        throw new Error('Je bent niet ingelogd. Log opnieuw in.');
    }

    const response = await fetch(
        'https://jcdqcgviossmrvlgsiqd.supabase.co/functions/v1/admin-operations',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, data })
        }
    );

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Er ging iets mis');
    }
    return result;
}

// ===== GEBRUIKERS LIJST LADEN =====
async function laadGebruikers() {
    if (!gebruikersLijst) return;
    
    gebruikersLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        const { data: rollen, error: rollenError } = await supabase
            .from('gebruikers_rollen')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (rollenError) throw rollenError;
        
        if (!rollen || rollen.length === 0) {
            gebruikersLijst.innerHTML = '<p>Geen gebruikers gevonden.</p>';
            if (aantalGebruikersSpan) aantalGebruikersSpan.textContent = '0';
            return;
        }
        
        alleGebruikers = rollen;
        if (aantalGebruikersSpan) aantalGebruikersSpan.textContent = rollen.length;
        
        // Filter op zoekterm
        let gefilterdeRollen = rollen;
        if (huidigeUserZoekterm) {
            const term = huidigeUserZoekterm.toLowerCase();
            gefilterdeRollen = rollen.filter(rol => 
                (rol.gebruikersnaam && rol.gebruikersnaam.toLowerCase().includes(term)) ||
                (rol.user_id && rol.user_id.toLowerCase().includes(term)) ||
                (rol.rol && rol.rol.toLowerCase().includes(term)) ||
                (rol.status && rol.status.toLowerCase().includes(term))
            );
        }
        
        let html = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 12px; text-align: left;">Gebruikersnaam</th>
                            <th style="padding: 12px; text-align: left;">E-mail</th>
                            <th style="padding: 12px; text-align: left;">Rol</th>
                            <th style="padding: 12px; text-align: left;">Chauffeur</th>
                            <th style="padding: 12px; text-align: left;">Chauffeursnummer</th>
                            <th style="padding: 12px; text-align: left;">Telefoon</th>
                            <th style="padding: 12px; text-align: left;">Status</th>
                            <th style="padding: 12px; text-align: left;">Aangemaakt</th>
                            <th style="padding: 12px; text-align: left;">Acties</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        for (const rol of gefilterdeRollen) {
            let statusDisplay = '';
            if (rol.status === 'wachtend') {
                statusDisplay = '⏳ Wachtend';
            } else if (rol.status === 'goedgekeurd') {
                statusDisplay = '✅ Goedgekeurd';
            } else if (rol.status === 'geweigerd') {
                statusDisplay = '❌ Geweigerd';
            } else {
                statusDisplay = '✅ Goedgekeurd';
            }
            
            const emailDisplay = rol.user_id ? rol.user_id.substring(0, 8) + '...@email' : '-';
            
            html += `
                <tr style="border-bottom: 1px solid #e9ecef;" data-userid="${rol.user_id}">
                    <td style="padding: 12px;"><strong>${escapeHtml(rol.gebruikersnaam || '-')}</strong></td>
                    <td style="padding: 12px;">${escapeHtml(emailDisplay)}</td>
                    <td style="padding: 12px;">${rol.rol === 'admin' ? '👑 Admin' : '👤 Gebruiker'}</td>
                    <td style="padding: 12px;">${rol.is_chauffeur ? '✅ Ja' : '❌ Nee'}</td>
                    <td style="padding: 12px;">${escapeHtml(rol.chauffeur_nummer || '-')}</td>
                    <td style="padding: 12px;">${escapeHtml(rol.chauffeur_telefoon || '-')}</td>
                    <td style="padding: 12px;">${statusDisplay}</td>
                    <td style="padding: 12px;">${new Date(rol.created_at).toLocaleDateString('nl-NL')}</td>
                    <td style="padding: 12px;" class="admin-buttons">
                        ${rol.status === 'wachtend' ? `
                            <button class="btn btn-success approve-btn" data-userid="${rol.user_id}" style="margin-right: 5px;">✅ Goedkeuren</button>
                            <button class="btn btn-danger reject-btn" data-userid="${rol.user_id}" style="margin-right: 5px;">❌ Weigeren</button>
                        ` : ''}
                        <button class="btn btn-secondary edit-user-btn" data-userid="${rol.user_id}" style="margin-right: 5px;">✏️ Bewerken</button>
                        <button class="btn btn-danger delete-user-btn" data-userid="${rol.user_id}">🗑️ Verwijderen</button>
                    </td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        gebruikersLijst.innerHTML = html;
        
        // Event listeners voor goedkeuren/weigeren
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userid;
                if (!confirm('Weet je zeker dat je deze gebruiker wilt goedkeuren?')) return;
                
                const { error } = await supabase
                    .from('gebruikers_rollen')
                    .update({ status: 'goedgekeurd' })
                    .eq('user_id', userId);
                
                if (error) {
                    showToast('Fout: ' + error.message, 'error');
                } else {
                    showToast('✅ Gebruiker goedgekeurd!', 'success');
                    laadGebruikers();
                    laadChauffeurs();
                }
            });
        });
        
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userid;
                if (!confirm('Weet je zeker dat je deze gebruiker wilt weigeren?')) return;
                
                const { error } = await supabase
                    .from('gebruikers_rollen')
                    .update({ status: 'geweigerd' })
                    .eq('user_id', userId);
                
                if (error) {
                    showToast('Fout: ' + error.message, 'error');
                } else {
                    showToast('❌ Gebruiker geweigerd.', 'error');
                    laadGebruikers();
                    laadChauffeurs();
                }
            });
        });
        
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => bewerkGebruiker(btn.dataset.userid));
        });
        
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', () => verwijderGebruiker(btn.dataset.userid));
        });
        
    } catch (err) {
        console.error('Fout:', err);
        gebruikersLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== CHAUFFEURS LIJST LADEN =====
async function laadChauffeurs() {
    if (!chauffeursLijst) return;
    
    try {
        // Haal alle gebruikers op die chauffeur zijn
        const { data, error } = await supabase
            .from('gebruikers_rollen')
            .select('*')
            .eq('is_chauffeur', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            chauffeursLijst.innerHTML = '<p>Geen chauffeurs gevonden.</p>';
            if (aantalChauffeursSpan) aantalChauffeursSpan.textContent = '0';
            return;
        }
        
        alleChauffeurs = data;
        if (aantalChauffeursSpan) aantalChauffeursSpan.textContent = data.length;
        
        // Filter op zoekterm
        let gefilterdeChauffeurs = data;
        if (huidigeChauffeurZoekterm) {
            const term = huidigeChauffeurZoekterm.toLowerCase();
            gefilterdeChauffeurs = data.filter(chauffeur => 
                (chauffeur.gebruikersnaam && chauffeur.gebruikersnaam.toLowerCase().includes(term)) ||
                (chauffeur.chauffeur_nummer && chauffeur.chauffeur_nummer.toLowerCase().includes(term)) ||
                (chauffeur.chauffeur_telefoon && chauffeur.chauffeur_telefoon.toLowerCase().includes(term))
            );
        }
        
        let html = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 12px; text-align: left;">Chauffeursnummer</th>
                            <th style="padding: 12px; text-align: left;">Gebruikersnaam</th>
                            <th style="padding: 12px; text-align: left;">Telefoon</th>
                            <th style="padding: 12px; text-align: left;">Status</th>
                            <th style="padding: 12px; text-align: left;">Acties</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        for (const chauffeur of gefilterdeChauffeurs) {
            html += `
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 12px;"><strong>${escapeHtml(chauffeur.chauffeur_nummer || '-')}</strong></td>
                    <td style="padding: 12px;">${escapeHtml(chauffeur.gebruikersnaam || '-')}</td>
                    <td style="padding: 12px;">${escapeHtml(chauffeur.chauffeur_telefoon || '-')}</td>
                    <td style="padding: 12px;">${chauffeur.status === 'goedgekeurd' ? '✅ Actief' : '⏳ Inactief'}</td>
                    <td style="padding: 12px;">
                        <button class="btn btn-secondary edit-chauffeur-btn" data-userid="${chauffeur.user_id}" style="margin-right: 5px;">✏️ Bewerken</button>
                    </td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        chauffeursLijst.innerHTML = html;
        
        document.querySelectorAll('.edit-chauffeur-btn').forEach(btn => {
            btn.addEventListener('click', () => bewerkGebruiker(btn.dataset.userid));
        });
        
    } catch (err) {
        console.error('Fout bij laden chauffeurs:', err);
        chauffeursLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== STATISTIEKEN LADEN =====
async function laadStatistieken() {
    try {
        // Aantal adressen
        const { count: adresCount } = await supabase
            .from('adressen')
            .select('*', { count: 'exact', head: true });
        
        if (aantalAdressenSpan) aantalAdressenSpan.textContent = adresCount || 0;
        
    } catch (err) {
        console.error('Fout bij laden statistieken:', err);
    }
}

// ===== GEBRUIKER BEWERKEN =====
async function bewerkGebruiker(userId) {
    try {
        const { data, error } = await supabase
            .from('gebruikers_rollen')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) throw error;
        
        currentEditingUserId = userId;
        userPopupTitle.textContent = 'Gebruiker bewerken';
        
        setValue('userGebruikersnaam', data.gebruikersnaam || '');
        setValue('userEmail', data.user_id || '');
        setValue('userPassword', '');
        setValue('userRol', data.rol || 'gebruiker');
        setValue('userIsChauffeur', data.is_chauffeur ? 'true' : 'false');
        setValue('chauffeurNummer', data.chauffeur_nummer || '');
        setValue('chauffeurTelefoon', data.chauffeur_telefoon || '');
        
        // Toon/verberg chauffeur velden
        chauffeurVelden.style.display = data.is_chauffeur ? 'block' : 'none';
        
        // Laad module rechten
        laadModuleRechten(userId);
        
        userPopup.style.display = 'flex';
        
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== GEBRUIKER VERWIJDEREN =====
async function verwijderGebruiker(userId) {
    if (!confirm('Weet je zeker dat je deze gebruiker volledig wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    
    try {
        const result = await callAdminAction('delete', { user_id: userId });
        if (result.success) {
            showToast('✅ Gebruiker volledig verwijderd!', 'success');
        } else {
            showToast('⚠️ ' + (result.warning || 'Gebruiker gedeeltelijk verwijderd.'), 'warning');
        }
        laadGebruikers();
        laadChauffeurs();
        laadStatistieken();
    } catch (err) {
        console.error('Fout bij verwijderen:', err);
        showToast('Fout bij verwijderen: ' + err.message, 'error');
    }
}

// ===== MODULE RECHTEN LADEN =====
async function laadModuleRechten(userId) {
    const moduleContainer = document.getElementById('moduleRechtenContainer');
    if (!moduleContainer) return;
    
    try {
        // Haal alle modules op
        const { data: modules, error: modError } = await supabase
            .from('modules')
            .select('*')
            .order('module_naam');
        
        if (modError) throw modError;
        
        // Haal bestaande rechten op voor deze gebruiker
        const { data: rechten, error: rechtError } = await supabase
            .from('gebruikers_module_rechten')
            .select('*')
            .eq('user_id', userId);
        
        if (rechtError) throw rechtError;
        
        const rechtenMap = {};
        rechten.forEach(r => {
            rechtenMap[r.module_sleutel] = r.actief;
        });
        
        let html = '<div class="module-checkboxes">';
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
                        ${module.beschrijving ? `<span style="color:#6c757d;font-size:0.85rem;"> - ${escapeHtml(module.beschrijving)}</span>` : ''}
                    </label>
                </div>
            `;
        });
        html += '</div>';
        
        moduleContainer.innerHTML = html;
        
    } catch (err) {
        console.error('Fout bij laden module rechten:', err);
        moduleContainer.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== GEBRUIKER OPSLAAN =====
async function saveUser() {
    const gebruikersnaam = getValue('userGebruikersnaam');
    const email = getValue('userEmail');
    const password = getValue('userPassword');
    const rol = getValue('userRol');
    const isChauffeur = getValue('userIsChauffeur') === 'true';
    const chauffeurNummer = getValue('chauffeurNummer');
    const chauffeurTelefoon = getValue('chauffeurTelefoon');
    
    if (!gebruikersnaam) {
        showToast('Vul een gebruikersnaam in', 'error');
        return;
    }
    
    try {
        const userData = {
            gebruikersnaam: gebruikersnaam,
            rol: rol,
            is_chauffeur: isChauffeur,
            chauffeur_nummer: isChauffeur ? chauffeurNummer : null,
            chauffeur_telefoon: isChauffeur ? chauffeurTelefoon : null
        };
        
        let result;
        if (currentEditingUserId) {
            // Update bestaande gebruiker
            result = await supabase
                .from('gebruikers_rollen')
                .update(userData)
                .eq('user_id', currentEditingUserId);
        } else {
            // Nieuwe gebruiker (moet eerst auth account hebben)
            if (!email || !password) {
                showToast('Vul e-mail en wachtwoord in voor nieuwe gebruiker', 'error');
                return;
            }
            
            // Maak auth account aan
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password
            });
            
            if (authError) throw authError;
            if (!authData.user) throw new Error('Account kon niet worden aangemaakt');
            
            result = await supabase
                .from('gebruikers_rollen')
                .insert([{
                    user_id: authData.user.id,
                    ...userData,
                    status: 'goedgekeurd'
                }]);
        }
        
        if (result.error) throw result.error;
        
        // Sla module rechten op
        const checkboxes = document.querySelectorAll('.module-recht-checkbox');
        for (const checkbox of checkboxes) {
            const moduleSleutel = checkbox.dataset.module;
            const actief = checkbox.checked;
            
            const userId = currentEditingUserId || result.data?.[0]?.user_id;
            if (userId) {
                await supabase
                    .from('gebruikers_module_rechten')
                    .upsert({
                        user_id: userId,
                        module_sleutel: moduleSleutel,
                        actief: actief
                    }, {
                        onConflict: 'user_id, module_sleutel'
                    });
            }
        }
        
        showToast('✅ Gebruiker opgeslagen!', 'success');
        userPopup.style.display = 'none';
        laadGebruikers();
        laadChauffeurs();
        laadStatistieken();
        
    } catch (err) {
        console.error('Fout bij opslaan:', err);
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== INITIALISATIE =====
document.addEventListener('DOMContentLoaded', async function() {
    // Controleer of gebruiker admin is
    const isAdmin = await requireAdmin('dashboard.html');
    if (!isAdmin) return;
    
    // Laad admin panel data
    laadGebruikers();
    laadChauffeurs();
    laadStatistieken();
    
    // ===== EVENT LISTENERS =====
    
    // Chauffeur toggle
    if (userIsChauffeur) {
        userIsChauffeur.addEventListener('change', function() {
            chauffeurVelden.style.display = this.value === 'true' ? 'block' : 'none';
        });
    }
    
    // Nieuwe gebruiker knop
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            currentEditingUserId = null;
            userPopupTitle.textContent = 'Nieuwe gebruiker';
            setValue('userGebruikersnaam', '');
            setValue('userEmail', '');
            setValue('userPassword', '');
            setValue('userRol', 'gebruiker');
            setValue('userIsChauffeur', 'false');
            setValue('chauffeurNummer', '');
            setValue('chauffeurTelefoon', '');
            chauffeurVelden.style.display = 'none';
            document.getElementById('moduleRechtenContainer').innerHTML = '<p>Laden...</p>';
            userPopup.style.display = 'flex';
        });
    }
    
    // Opslaan knop
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', saveUser);
    }
    
    // Sluiten popup
    if (closeUserPopup) {
        closeUserPopup.addEventListener('click', () => {
            userPopup.style.display = 'none';
        });
    }
    
    // Zoek functionaliteit gebruikers
    if (searchUserInput) {
        searchUserInput.addEventListener('input', (e) => {
            huidigeUserZoekterm = e.target.value;
            laadGebruikers();
        });
    }
    
    if (clearUserSearchBtn) {
        clearUserSearchBtn.addEventListener('click', () => {
            searchUserInput.value = '';
            huidigeUserZoekterm = '';
            laadGebruikers();
            searchUserInput.focus();
        });
    }
    
    // Zoek functionaliteit chauffeurs
    if (searchChauffeurInput) {
        searchChauffeurInput.addEventListener('input', (e) => {
            huidigeChauffeurZoekterm = e.target.value;
            laadChauffeurs();
        });
    }
    
    if (clearChauffeurSearchBtn) {
        clearChauffeurSearchBtn.addEventListener('click', () => {
            searchChauffeurInput.value = '';
            huidigeChauffeurZoekterm = '';
            laadChauffeurs();
            searchChauffeurInput.focus();
        });
    }
    
    // Startpunt opslaan
    if (saveStartpuntBtn && startpuntInstelling) {
        saveStartpuntBtn.addEventListener('click', () => {
            const startpunt = startpuntInstelling.value;
            localStorage.setItem('startpunt', startpunt);
            showToast('✅ Startpunt opgeslagen!', 'success');
        });
        
        // Laad opgeslagen startpunt
        const savedStartpunt = localStorage.getItem('startpunt');
        if (savedStartpunt) {
            startpuntInstelling.value = savedStartpunt;
        }
    }
    
    // Sluiten bij klik buiten popup
    window.addEventListener('click', (e) => {
        if (e.target === userPopup) {
            userPopup.style.display = 'none';
        }
    });
});