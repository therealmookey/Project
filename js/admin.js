// ===== ADMIN FUNCTIES - MET EDGE FUNCTION & SESSIE BEHOUD =====

console.log('admin.js geladen');

document.addEventListener('DOMContentLoaded', async function() {
    
    if (!window.supabase) {
        console.error('Supabase niet beschikbaar!');
        return;
    }
    
    // Controleer of de ingelogde gebruiker een admin is
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    console.log('Ingelogde user ID:', user.id);
    
    // Check admin status
    const { data: userRollen, error: rolError } = await window.supabase
        .from('gebruikers_rollen')
        .select('rol')
        .eq('user_id', user.id);
    
    console.log('User rollen:', userRollen);
    
    let isAdmin = false;
    if (userRollen && userRollen.length > 0) {
        isAdmin = (userRollen[0].rol === 'admin');
    }
    
    if (!isAdmin) {
        alert('Je hebt geen toegang tot deze pagina. Alleen admins kunnen hier komen.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    console.log('✅ Admin toegang verleend!');
    
    // DOM elementen
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
    const aantalAdressenSpan = document.getElementById('aantalAdressen');
    const saveStartpuntBtn = document.getElementById('saveStartpuntBtn');
    const startpuntInstelling = document.getElementById('startpuntInstelling');
    
    let currentUserId = null;
    let alleGebruikers = [];
    let alleChauffeurs = [];
    let huidigeUserZoekterm = '';
    let huidigeChauffeurZoekterm = '';
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ===== EDGE FUNCTION AANROEP =====
    async function callAdminAction(action, data) {
        const { data: { session } } = await window.supabase.auth.getSession();
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
    
    // ===== GEBRUIKER VERWIJDEREN (via Edge Function) =====
    async function verwijderGebruiker(userId) {
        if (userId === user.id) {
            alert('Je kunt jezelf niet verwijderen!');
            return;
        }
        
        if (!confirm('Weet je zeker dat je deze gebruiker volledig wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
        
        try {
            const result = await callAdminAction('delete', { user_id: userId });
            
            if (result.success) {
                alert('✅ Gebruiker volledig verwijderd!');
            } else {
                alert('⚠️ ' + (result.warning || 'Gebruiker gedeeltelijk verwijderd.'));
            }
            
            laadGebruikers();
            laadChauffeurs();
            laadStatistieken();
            
        } catch (err) {
            console.error('Fout bij verwijderen:', err);
            alert('Fout bij verwijderen: ' + err.message);
        }
    }
    
    // ===== GEBRUIKERS LIJST LADEN =====
    async function laadGebruikers() {
        if (!gebruikersLijst) return;
        
        gebruikersLijst.innerHTML = '<p>Bezig met laden...</p>';
        
        try {
            const { data: rollen, error: rollenError } = await window.supabase
                .from('gebruikers_rollen')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (rollenError) throw rollenError;
            
            if (!rollen || rollen.length === 0) {
                gebruikersLijst.innerHTML = '<p>Geen gebruikers gevonden.</p>';
                if (aantalGebruikersSpan) aantalGebruikersSpan.textContent = '0';
                return;
            }
            
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
                // Status weergave
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
                
                // E-mail weergave
                const emailDisplay = rol.user_id === user.id ? 'Jouw account' : rol.user_id.substring(0, 8) + '...@email';
                
                html += `
                    <tr style="border-bottom: 1px solid #e9ecef;" data-userid="${rol.user_id}">
                        <td style="padding: 12px;"><strong>${escapeHtml(rol.gebruikersnaam || '-')}</strong></td>
                        <td style="padding: 12px;">${escapeHtml(emailDisplay)}</td>
                        <td style="padding: 12px;">${rol.rol === 'admin' ? '👑 Admin' : '👤 Gebruiker'}</td>
                        <td style="padding: 12px;">${rol.is_chauffeur ? '✅ Ja' : '❌ Nee'}</td>
                        <td style="padding: 12px;">${rol.chauffeur_nummer || '-'}</td>
                        <td style="padding: 12px;">${rol.chauffeur_telefoon || '-'}</td>
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
                    
                    const { error } = await window.supabase
                        .from('gebruikers_rollen')
                        .update({ status: 'goedgekeurd' })
                        .eq('user_id', userId);
                    
                    if (error) {
                        alert('Fout: ' + error.message);
                    } else {
                        alert('✅ Gebruiker goedgekeurd!');
                        laadGebruikers();
                        laadChauffeurs();
                    }
                });
            });
            
            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userid;
                    if (!confirm('Weet je zeker dat je deze gebruiker wilt weigeren?')) return;
                    
                    const { error } = await window.supabase
                        .from('gebruikers_rollen')
                        .update({ status: 'geweigerd' })
                        .eq('user_id', userId);
                    
                    if (error) {
                        alert('Fout: ' + error.message);
                    } else {
                        alert('❌ Gebruiker geweigerd.');
                        laadGebruikers();
                        laadChauffeurs();
                    }
                });
            });
            
            // Edit en delete buttons
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
        
        chauffeursLijst.innerHTML = '<p>Bezig met laden...</p>';
        
        try {
            const { data: chauffeurs, error } = await window.supabase
                .from('gebruikers_rollen')
                .select('*')
                .eq('is_chauffeur', true)
                .order('chauffeur_nummer', { ascending: true });
            
            if (error) throw error;
            
            if (!chauffeurs || chauffeurs.length === 0) {
                chauffeursLijst.innerHTML = '<p>Geen chauffeurs gevonden. Wijs een gebruiker aan als chauffeur.</p>';
                return;
            }
            
            let html = `
                <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 12px; text-align: left;">Chauffeursnummer</th>
                            <th style="padding: 12px; text-align: left;">Gebruikersnaam</th>
                            <th style="padding: 12px; text-align: left;">Telefoon</th>
                            <th style="padding: 12px; text-align: left;">Rol</th>
                            <th style="padding: 12px; text-align: left;">Status</th>
                            <th style="padding: 12px; text-align: left;">Acties</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (const chauffeur of chauffeurs) {
                let statusDisplay = '✅ Goedgekeurd';
                if (chauffeur.status === 'wachtend') statusDisplay = '⏳ Wachtend';
                else if (chauffeur.status === 'geweigerd') statusDisplay = '❌ Geweigerd';
                
                html += `
                    <tr style="border-bottom: 1px solid #e9ecef;">
                        <td style="padding: 12px;">${escapeHtml(chauffeur.chauffeur_nummer || '-')}</td>
                        <td style="padding: 12px;"><strong>${escapeHtml(chauffeur.gebruikersnaam || '-')}</strong></td>
                        <td style="padding: 12px;">${escapeHtml(chauffeur.chauffeur_telefoon || '-')}</td>
                        <td style="padding: 12px;">${chauffeur.rol === 'admin' ? '👑 Admin' : '👤 Gebruiker'}</td>
                        <td style="padding: 12px;">${statusDisplay}</td>
                        <td style="padding: 12px;" class="admin-buttons">
                            ${chauffeur.status === 'wachtend' ? `
                                <button class="btn btn-success approve-chauffeur-btn" data-userid="${chauffeur.user_id}" style="margin-right: 5px;">✅ Goedkeuren</button>
                                <button class="btn btn-danger reject-chauffeur-btn" data-userid="${chauffeur.user_id}" style="margin-right: 5px;">❌ Weigeren</button>
                            ` : ''}
                            <button class="btn btn-secondary edit-chauffeur-btn" data-userid="${chauffeur.user_id}">✏️ Bewerken</button>
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
            
            document.querySelectorAll('.approve-chauffeur-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userid;
                    if (!confirm('Weet je zeker dat je deze chauffeur wilt goedkeuren?')) return;
                    
                    const { error } = await window.supabase
                        .from('gebruikers_rollen')
                        .update({ status: 'goedgekeurd' })
                        .eq('user_id', userId);
                    
                    if (error) {
                        alert('Fout: ' + error.message);
                    } else {
                        alert('✅ Chauffeur goedgekeurd!');
                        laadGebruikers();
                        laadChauffeurs();
                    }
                });
            });
            
            document.querySelectorAll('.reject-chauffeur-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userid;
                    if (!confirm('Weet je zeker dat je deze chauffeur wilt weigeren?')) return;
                    
                    const { error } = await window.supabase
                        .from('gebruikers_rollen')
                        .update({ status: 'geweigerd' })
                        .eq('user_id', userId);
                    
                    if (error) {
                        alert('Fout: ' + error.message);
                    } else {
                        alert('❌ Chauffeur geweigerd.');
                        laadGebruikers();
                        laadChauffeurs();
                    }
                });
            });
            
            document.querySelectorAll('.edit-chauffeur-btn').forEach(btn => {
                btn.addEventListener('click', () => bewerkGebruiker(btn.dataset.userid));
            });
            
        } catch (err) {
            console.error('Fout:', err);
            chauffeursLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
        }
    }
    
    // ===== STATISTIEKEN LADEN =====
    async function laadStatistieken() {
        try {
            const { count: adresCount } = await window.supabase
                .from('adressen')
                .select('*', { count: 'exact', head: true });
            
            const { count: userCount } = await window.supabase
                .from('gebruikers_rollen')
                .select('*', { count: 'exact', head: true });
            
            const { count: wachtendCount } = await window.supabase
                .from('gebruikers_rollen')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'wachtend');
            
            if (aantalAdressenSpan) aantalAdressenSpan.textContent = adresCount || 0;
            if (aantalGebruikersSpan) {
                aantalGebruikersSpan.textContent = `${userCount || 0} (${wachtendCount || 0} wachtend)`;
            }
            
        } catch (err) {
            console.error('Fout bij laden statistieken:', err);
        }
    }
    
    // ===== GEBRUIKER BEWERKEN =====
    async function bewerkGebruiker(userId) {
        currentUserId = userId;
        userPopupTitle.textContent = 'Gebruiker bewerken';
        
        try {
            const { data, error } = await window.supabase
                .from('gebruikers_rollen')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) throw error;
            
            document.getElementById('userGebruikersnaam').value = data.gebruikersnaam || '';
            document.getElementById('userEmail').value = '';
            document.getElementById('userEmail').disabled = true;
            document.getElementById('userEmail').placeholder = 'E-mail niet bewerkbaar';
            
            document.getElementById('userPassword').value = '';
            document.getElementById('userPassword').required = false;
            
            document.getElementById('userRol').value = data.rol;
            document.getElementById('userIsChauffeur').value = data.is_chauffeur ? 'true' : 'false';
            document.getElementById('chauffeurNummer').value = data.chauffeur_nummer || '';
            document.getElementById('chauffeurTelefoon').value = data.chauffeur_telefoon || '';
            
            chauffeurVelden.style.display = data.is_chauffeur ? 'block' : 'none';
            
            userPopup.style.display = 'flex';
            
        } catch (err) {
            alert('Fout bij laden: ' + err.message);
        }
    }
    
    // ===== NIEUWE GEBRUIKER =====
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            currentUserId = null;
            userPopupTitle.textContent = 'Nieuwe gebruiker';
            document.getElementById('userGebruikersnaam').value = '';
            document.getElementById('userEmail').value = '';
            document.getElementById('userEmail').disabled = false;
            document.getElementById('userPassword').value = '';
            document.getElementById('userPassword').required = true;
            document.getElementById('userRol').value = 'gebruiker';
            document.getElementById('userIsChauffeur').value = 'false';
            document.getElementById('chauffeurNummer').value = '';
            document.getElementById('chauffeurTelefoon').value = '';
            chauffeurVelden.style.display = 'none';
            userPopup.style.display = 'flex';
        });
    }
    
    // ===== TOON/VERBERG CHAUFFEUR VELDEN =====
    if (userIsChauffeur) {
        userIsChauffeur.addEventListener('change', (e) => {
            chauffeurVelden.style.display = e.target.value === 'true' ? 'block' : 'none';
        });
    }
    
    // ===== OPSLAAN GEBRUIKER (met sessie behoud) =====
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', async () => {
            const gebruikersnaam = document.getElementById('userGebruikersnaam').value;
            const email = document.getElementById('userEmail').value;
            const password = document.getElementById('userPassword').value;
            const rol = document.getElementById('userRol').value;
            const isChauffeur = document.getElementById('userIsChauffeur').value === 'true';
            const chauffeurNummer = document.getElementById('chauffeurNummer').value;
            const chauffeurTelefoon = document.getElementById('chauffeurTelefoon').value;
            
            if (!gebruikersnaam) {
                alert('Gebruikersnaam is verplicht');
                return;
            }
            
            try {
                if (currentUserId) {
                    // Update bestaande gebruiker via Edge Function
                    const updateData = {
                        gebruikersnaam: gebruikersnaam,
                        rol: rol,
                        is_chauffeur: isChauffeur,
                        chauffeur_nummer: chauffeurNummer || null,
                        chauffeur_telefoon: chauffeurTelefoon || null
                    };
                    
                    const result = await callAdminAction('update', { 
                        user_id: currentUserId, 
                        ...updateData 
                    });
                    
                    if (result.success) {
                        alert('Gebruiker bijgewerkt!');
                    } else {
                        throw new Error(result.error || 'Update mislukt');
                    }
                    
                } else {
                    // Controleer of gebruikersnaam uniek is
                    const { data: bestaande } = await window.supabase
                        .from('gebruikers_rollen')
                        .select('gebruikersnaam')
                        .eq('gebruikersnaam', gebruikersnaam);
                    
                    if (bestaande && bestaande.length > 0) {
                        alert('Deze gebruikersnaam is al in gebruik');
                        return;
                    }
                    
                    if (!password || password.length < 6) {
                        alert('Wachtwoord is verplicht en moet minimaal 6 tekens bevatten');
                        return;
                    }
                    
                    // ===== BEWAAR DE HUIDIGE SESSIE =====
                    const { data: { session: huidigeSessie } } = await window.supabase.auth.getSession();
                    console.log('Huidige sessie bewaard:', huidigeSessie ? 'Ja' : 'Nee');
                    
                    // Maak account aan in Auth
                    const { data: authData, error: authError } = await window.supabase.auth.signUp({
                        email: email,
                        password: password
                    });
                    
                    if (authError) throw authError;
                    
                    // ===== HERSTEL DE OUDE SESSIE =====
                    if (huidigeSessie) {
                        console.log('Herstellen van oude sessie...');
                        await window.supabase.auth.setSession(huidigeSessie);
                    }
                    
                    if (authData.user) {
                        const result = await callAdminAction('insert', {
                            user_id: authData.user.id,
                            gebruikersnaam: gebruikersnaam,
                            rol: rol,
                            is_chauffeur: isChauffeur,
                            chauffeur_nummer: chauffeurNummer || null,
                            chauffeur_telefoon: chauffeurTelefoon || null,
                            status: 'wachtend'
                        });
                        
                        if (result.success) {
                            alert(`Gebruiker ${gebruikersnaam} aangemaakt! Status: wachtend op goedkeuring.`);
                        } else {
                            throw new Error(result.error || 'Insert mislukt');
                        }
                    }
                }
                
                userPopup.style.display = 'none';
                laadGebruikers();
                laadChauffeurs();
                laadStatistieken();
                
            } catch (err) {
                console.error('Fout:', err);
                alert('Fout: ' + err.message);
            }
        });
    }
    
    // ===== SLUIT POPUP =====
    if (closeUserPopup) {
        closeUserPopup.addEventListener('click', () => {
            userPopup.style.display = 'none';
        });
    }
    
    // ===== STARTPUNT OPSLAAN =====
    if (saveStartpuntBtn) {
        saveStartpuntBtn.addEventListener('click', () => {
            const startpunt = startpuntInstelling.value;
            localStorage.setItem('startpunt', JSON.stringify({ adres: startpunt }));
            alert('Startpunt opgeslagen!');
        });
    }
    
    // ===== ZOEK FUNCTIONALITEIT =====
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
    
    // ===== TAB FUNCTIONALITEIT =====
    const tabButtons = document.querySelectorAll('.admin-tabs .tab-btn');
    const tabs = document.querySelectorAll('.admin-tab');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            tabs.forEach(tab => tab.classList.remove('active'));
            
            if (tabId === 'gebruikers') {
                document.getElementById('tabGebruikers').classList.add('active');
                laadGebruikers();
            } else if (tabId === 'chauffeurs') {
                document.getElementById('tabChauffeurs').classList.add('active');
                laadChauffeurs();
            } else if (tabId === 'instellingen') {
                document.getElementById('tabInstellingen').classList.add('active');
                laadStatistieken();
            }
        });
    });
    
    // ===== KLIK BUITEN POPUP SLUITEN =====
    window.addEventListener('click', (e) => {
        if (e.target === userPopup) {
            userPopup.style.display = 'none';
        }
    });
    
    // ===== INITIALISEER =====
    laadGebruikers();
    laadStatistieken();
    
    // Laad opgeslagen startpunt
    const opgeslagenStartpunt = localStorage.getItem('startpunt');
    if (opgeslagenStartpunt && startpuntInstelling) {
        try {
            const parsed = JSON.parse(opgeslagenStartpunt);
            startpuntInstelling.value = parsed.adres;
        } catch(e) {}
    }
    
});