// ===== AUTHENTICATIE FUNCTIES (MET BEEÏNDIGING) =====

console.log('auth.js geladen');

window.addEventListener('load', function() {
    
    if (!window.supabase) {
        console.error('Supabase niet gevonden!');
        return;
    }
    
    console.log('Auth gestart...');
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTabBtn = document.getElementById('loginTabBtn');
    const registerTabBtn = document.getElementById('registerTabBtn');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const forgotLink = document.getElementById('forgotPasswordLink');
    const resetPopup = document.getElementById('resetPopup');
    const closePopup = document.getElementById('closePopup');
    const resetBtn = document.getElementById('resetBtn');
    
    function toonBericht(elementId, bericht, type) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = bericht;
            element.className = `message ${type}`;
            element.style.display = 'block';
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }
    
    // Tabbladen
    if (loginTabBtn && registerTabBtn) {
        loginTabBtn.onclick = () => {
            loginTabBtn.classList.add('active');
            registerTabBtn.classList.remove('active');
            if (loginForm) loginForm.classList.add('active');
            if (registerForm) registerForm.classList.remove('active');
        };
        
        registerTabBtn.onclick = () => {
            registerTabBtn.classList.add('active');
            loginTabBtn.classList.remove('active');
            if (registerForm) registerForm.classList.add('active');
            if (loginForm) loginForm.classList.remove('active');
        };
    }
    
    // REGISTREREN (met bevestiging)
    if (registerBtn) {
        registerBtn.onclick = async () => {
            const gebruikersnaam = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            
            if (!gebruikersnaam || !email || !password) {
                toonBericht('message', 'Vul alle velden in', 'error');
                return;
            }
            
            if (password.length < 6) {
                toonBericht('message', 'Wachtwoord moet minimaal 6 tekens zijn', 'error');
                return;
            }
            
            try {
                // Account aanmaken in Supabase Auth
                const { data: authData, error: authError } = await window.supabase.auth.signUp({
                    email: email,
                    password: password
                });
                
                if (authError) throw authError;
                
                if (authData.user) {
                    // Rol en gebruikersnaam toevoegen met status 'wachtend'
                    const { error: rolError } = await window.supabase
                        .from('gebruikers_rollen')
                        .insert([{
                            user_id: authData.user.id,
                            gebruikersnaam: gebruikersnaam,
                            rol: 'gebruiker',
                            is_chauffeur: false,
                            status: 'wachtend'
                        }]);
                    
                    if (rolError) throw rolError;
                    
                    toonBericht('message', 
                        '✅ Account aanvraag ontvangen! Een administrator moet je account nog goedkeuren. Je ontvangt een e-mail zodra dit is gebeurd.', 
                        'success'
                    );
                    
                    document.getElementById('registerUsername').value = '';
                    document.getElementById('registerEmail').value = '';
                    document.getElementById('registerPassword').value = '';
                    
                    // Stuur notificatie naar admin (via email)
                    await stuurAdminNotificatie(gebruikersnaam, email);
                }
            } catch (err) {
                toonBericht('message', 'Fout: ' + err.message, 'error');
            }
        };
    }
    
    // Admin notificatie functie (via een simpele alert voor nu)
    async function stuurAdminNotificatie(gebruikersnaam, email) {
        // Haal admin emails op
        const { data: admins, error } = await window.supabase
            .from('admins')
            .select('email');
        
        if (error) {
            console.error('Fout bij ophalen admins:', error);
            return;
        }
        
        // Voor nu: toon een melding in de console
        console.log(`🔔 Nieuwe registratie: ${gebruikersnaam} (${email})`);
        console.log('📋 Ga naar admin panel om goed te keuren.');
        
        // In een latere versie: stuur een e-mail
    }
    
    // INLOGGEN (met status check)
    if (loginBtn) {
        loginBtn.onclick = async () => {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            if (!email || !password) {
                toonBericht('message', 'Vul e-mail en wachtwoord in', 'error');
                return;
            }
            
            try {
                const { data, error } = await window.supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    toonBericht('message', error.message, 'error');
                    return;
                }
                
                // Controleer de status van de gebruiker
                const { data: userData, error: statusError } = await window.supabase
                    .from('gebruikers_rollen')
                    .select('status, rol')
                    .eq('user_id', data.user.id)
                    .single();
                
                if (statusError) {
                    console.error('Fout bij ophalen status:', statusError);
                    await window.supabase.auth.signOut();
                    toonBericht('message', 'Account niet gevonden. Neem contact op met de beheerder.', 'error');
                    return;
                }
                
                if (userData.status === 'wachtend') {
                    await window.supabase.auth.signOut();
                    toonBericht('message', '⏳ Je account wacht nog op goedkeuring door een administrator. Je ontvangt een e-mail zodra dit is gebeurd.', 'error');
                    return;
                }
                
                if (userData.status === 'geweigerd') {
                    await window.supabase.auth.signOut();
                    toonBericht('message', '❌ Je account is geweigerd. Neem contact op met de beheerder.', 'error');
                    return;
                }
                
                // Alles goed, gebruiker mag inloggen
                toonBericht('message', 'Ingelogd! Doorsturen...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                
            } catch (err) {
                toonBericht('message', 'Fout: ' + err.message, 'error');
            }
        };
    }
    
    // Wachtwoord vergeten
    if (forgotLink) {
        forgotLink.onclick = (e) => {
            e.preventDefault();
            if (resetPopup) resetPopup.style.display = 'flex';
        };
    }
    
    if (closePopup) {
        closePopup.onclick = () => {
            if (resetPopup) resetPopup.style.display = 'none';
        };
    }
    
    if (resetBtn) {
        resetBtn.onclick = async () => {
            const email = document.getElementById('resetEmail').value;
            if (!email) {
                alert('Vul je e-mailadres in');
                return;
            }
            
            try {
                const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/Abbott-project/reset-password.html'
                });
                
                if (error) {
                    alert('Fout: ' + error.message);
                } else {
                    alert('Resetlink verzonden! Controleer je e-mail.');
                    if (resetPopup) resetPopup.style.display = 'none';
                }
            } catch (err) {
                alert('Fout: ' + err.message);
            }
        };
    }
    
});