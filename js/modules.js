// ===== MODULEBEHEER FUNCTIES =====

console.log('modules.js geladen');

document.addEventListener('DOMContentLoaded', async function() {
    
    if (!window.supabase) {
        console.error('Supabase niet beschikbaar!');
        return;
    }
    
    // Check admin status
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    const { data: userRollen } = await window.supabase
        .from('gebruikers_rollen')
        .select('rol')
        .eq('user_id', user.id)
        .maybeSingle();
    
    if (!userRollen || userRollen.rol !== 'admin') {
        alert('Je hebt geen toegang tot deze pagina. Alleen admins kunnen hier komen.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    console.log('✅ Admin toegang voor modulebeheer');
    
    // DOM elementen
    const gebruikersModuleLijst = document.getElementById('gebruikersModuleLijst');
    const modulesLijst = document.getElementById('modulesLijst');
    const searchModuleUserInput = document.getElementById('searchModuleUserInput');
    const clearModuleUserSearchBtn = document.getElementById('clearModuleUserSearchBtn');
    const modulePopup = document.getElementById('modulePopup');
    const closeModulePopup = document.getElementById('closeModulePopup');
    const saveModuleRightsBtn = document.getElementById('saveModuleRightsBtn');
    const modulePopupTitle = document.getElementById('modulePopupTitle');
    const modulePopupUser = document.getElementById('modulePopupUser');
    const moduleCheckboxes = document.getElementById('moduleCheckboxes');
    
    let alleModules = [];
    let huidigeGebruikerId = null;
    let huidigeGebruikersnaam = '';
    let huidigeModuleRechten = {};
    
    // Tab functionaliteit
    const tabButtons = document.querySelectorAll('.module-tabs .tab-btn');
    const tabs = document.querySelectorAll('.module-tab');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            if (tabId === 'gebruikers') {
                document.getElementById('tabGebruikers').classList.add('active');
                laadGebruikersModules();
            } else if (tabId === 'modules') {
                document.getElementById('tabModules').classList.add('active');
                laadModules();
            }
        });
    });
    
    // Haal alle modules op
    async function laadModules() {
        if (!modulesLijst) return;
        
        modulesLijst.innerHTML = '<p>Laden...</p>';
        
        try {
            const { data, error } = await window.supabase
                .from('modules')
                .select('*')
                .order('module_naam');
            
            if (error) throw error;
            
            alleModules = data || [];
            
            if (alleModules.length === 0) {
                modulesLijst.innerHTML = '<p>Geen modules gevonden.</p>';
                return;
            }
            
            let html = `
                <div style="overflow-x: auto;">
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:12px;text-align:left;">Module</th>
                            <th style="padding:12px;text-align:left;">Sleutel</th>
                            <th style="padding:12px;text-align:left;">Beschrijving</th>
                            <th style="padding:12px;text-align:left;">Standaard aan</th>
                            <th style="padding:12px;text-align:left;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (const module of alleModules) {
                html += `
                    <tr style="border-bottom:1px solid #e9ecef;">
                        <td style="padding:12px;"><strong>${escapeHtml(module.module_naam)}</strong></td>
                        <td style="padding:12px;"><code>${escapeHtml(module.module_sleutel)}</code></td>
                        <td style="padding:12px;">${escapeHtml(module.beschrijving || '-')}</td>
                        <td style="padding:12px;">${module.standaard_aan ? '✅ Ja' : '❌ Nee'}</td>
                        <td style="padding:12px;">
                            <button class="btn btn-secondary" onclick="alert('Module status wijzigen komt later')">🔄 Wijzig</button>
                        </td>
                    </tr>
                `;
            }
            
            html += `
                    </tbody>
                </table>
                </div>
            `;
            
            modulesLijst.innerHTML = html;
            
        } catch (err) {
            console.error('Fout:', err);
            modulesLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
        }
    }
    
    // Haal alle gebruikers met module rechten op
    async function laadGebruikersModules() {
        if (!gebruikersModuleLijst) return;
        
        gebruikersModuleLijst.innerHTML = '<p>Laden...</p>';
        
        try {
            // Haal alle gebruikers op uit gebruikers_rollen
            const { data: gebruikers, error: userError } = await window.supabase
                .from('gebruikers_rollen')
                .select('*')
                .order('gebruikersnaam');
            
            if (userError) throw userError;
            
            if (!gebruikers || gebruikers.length === 0) {
                gebruikersModuleLijst.innerHTML = '<p>Geen gebruikers gevonden.</p>';
                return;
            }
            
            // Haal alle module rechten op
            const { data: rechten, error: rechtenError } = await window.supabase
                .from('gebruikers_module_rechten')
                .select('*');
            
            if (rechtenError) throw rechtenError;
            
            // Haal alle modules op
            const { data: modules, error: modError } = await window.supabase
                .from('modules')
                .select('*');
            
            if (modError) throw modError;
            
            // Bouw een map van rechten per gebruiker
            const rechtenMap = {};
            rechten.forEach(r => {
                if (!rechtenMap[r.user_id]) rechtenMap[r.user_id] = {};
                rechtenMap[r.user_id][r.module_sleutel] = r.actief;
            });
            
            let html = `
                <div style="overflow-x: auto;">
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:12px;text-align:left;">Gebruikersnaam</th>
                            <th style="padding:12px;text-align:left;">Rol</th>
                            <th style="padding:12px;text-align:left;">Actieve modules</th>
                            <th style="padding:12px;text-align:left;">Acties</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (const gebruiker of gebruikers) {
                const userRechten = rechtenMap[gebruiker.user_id] || {};
                const actieveModules = modules.filter(m => {
                    // Als er een recht is ingesteld, gebruik die waarde
                    if (userRechten[m.module_sleutel] !== undefined) {
                        return userRechten[m.module_sleutel];
                    }
                    // Anders gebruik de standaard waarde
                    return m.standaard_aan;
                });
                
                const moduleNamen = actieveModules.map(m => m.module_naam).join(', ');
                
                html += `
                    <tr style="border-bottom:1px solid #e9ecef;">
                        <td style="padding:12px;"><strong>${escapeHtml(gebruiker.gebruikersnaam || gebruiker.user_id)}</strong></td>
                        <td style="padding:12px;">${gebruiker.rol === 'admin' ? '👑 Admin' : '👤 Gebruiker'}</td>
                        <td style="padding:12px; font-size:0.85rem;">${moduleNamen || 'Geen modules'}</td>
                        <td style="padding:12px;">
                            <button class="btn btn-primary edit-module-btn" data-userid="${gebruiker.user_id}" data-username="${escapeHtml(gebruiker.gebruikersnaam || gebruiker.user_id)}">✏️ Rechten bewerken</button>
                        </td>
                    </tr>
                `;
            }
            
            html += `
                    </tbody>
                </table>
                </div>
            `;
            
            gebruikersModuleLijst.innerHTML = html;
            
            document.querySelectorAll('.edit-module-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openModulePopup(btn.dataset.userid, btn.dataset.username);
                });
            });
            
        } catch (err) {
            console.error('Fout:', err);
            gebruikersModuleLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
        }
    }
    
    // Open module popup voor een gebruiker
    async function openModulePopup(userId, username) {
        huidigeGebruikerId = userId;
        huidigeGebruikersnaam = username;
        
        modulePopupTitle.textContent = 'Module rechten bewerken';
        modulePopupUser.textContent = username;
        
        try {
            // Haal alle modules op
            const { data: modules, error: modError } = await window.supabase
                .from('modules')
                .select('*')
                .order('module_naam');
            
            if (modError) throw modError;
            
            // Haal bestaande rechten op voor deze gebruiker
            const { data: rechten, error: rechtenError } = await window.supabase
                .from('gebruikers_module_rechten')
                .select('*')
                .eq('user_id', userId);
            
            if (rechtenError) throw rechtenError;
            
            // Bouw een map van bestaande rechten
            const rechtenMap = {};
            rechten.forEach(r => {
                rechtenMap[r.module_sleutel] = r.actief;
            });
            
            // Genereer checkboxes
            let html = '';
            for (const module of modules) {
                const isActive = rechtenMap[module.module_sleutel] !== undefined ? rechtenMap[module.module_sleutel] : module.standaard_aan;
                const checked = isActive ? 'checked' : '';
                
                html += `
                    <div class="module-checkbox-item">
                        <label>
                            <input type="checkbox" class="module-checkbox" data-module="${module.module_sleutel}" ${checked}>
                            <strong>${escapeHtml(module.module_naam)}</strong>
                            <span style="font-size:0.85rem;color:#6c757d;">${escapeHtml(module.beschrijving || '')}</span>
                        </label>
                    </div>
                `;
            }
            
            moduleCheckboxes.innerHTML = html;
            modulePopup.style.display = 'flex';
            
        } catch (err) {
            alert('Fout bij laden: ' + err.message);
        }
    }
    
    // Opslaan module rechten
    if (saveModuleRightsBtn) {
        saveModuleRightsBtn.addEventListener('click', async () => {
            if (!huidigeGebruikerId) {
                alert('Geen gebruiker geselecteerd');
                return;
            }
            
            // Verzamel de geselecteerde modules
            const checkboxes = document.querySelectorAll('.module-checkbox');
            const rechtenData = [];
            
            checkboxes.forEach(cb => {
                rechtenData.push({
                    user_id: huidigeGebruikerId,
                    module_sleutel: cb.dataset.module,
                    actief: cb.checked
                });
            });
            
            try {
                // Verwijder bestaande rechten voor deze gebruiker
                const { error: deleteError } = await window.supabase
                    .from('gebruikers_module_rechten')
                    .delete()
                    .eq('user_id', huidigeGebruikerId);
                
                if (deleteError) throw deleteError;
                
                // Voeg nieuwe rechten toe
                const { error: insertError } = await window.supabase
                    .from('gebruikers_module_rechten')
                    .insert(rechtenData);
                
                if (insertError) throw insertError;
                
                alert('Module rechten opgeslagen!');
                modulePopup.style.display = 'none';
                laadGebruikersModules();
                
            } catch (err) {
                alert('Fout bij opslaan: ' + err.message);
            }
        });
    }
    
    if (closeModulePopup) {
        closeModulePopup.addEventListener('click', () => {
            modulePopup.style.display = 'none';
        });
    }
    
    // Zoek functionaliteit
    if (searchModuleUserInput) {
        searchModuleUserInput.addEventListener('input', () => {
            const filter = searchModuleUserInput.value.toLowerCase();
            const rows = document.querySelectorAll('#gebruikersModuleLijst tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? '' : 'none';
            });
        });
    }
    
    if (clearModuleUserSearchBtn) {
        clearModuleUserSearchBtn.addEventListener('click', () => {
            searchModuleUserInput.value = '';
            const rows = document.querySelectorAll('#gebruikersModuleLijst tbody tr');
            rows.forEach(row => row.style.display = '');
            searchModuleUserInput.focus();
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === modulePopup) modulePopup.style.display = 'none';
    });
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Initialiseer
    laadGebruikersModules();
    
});