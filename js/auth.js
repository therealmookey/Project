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
            }, 8000);
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
    
    // ===== REGISTREREN (MET FALLBACK) =====
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
        
        // Controleer of gebruikersnaam al bestaat
        try {
            const { data: bestaande } = await window.supabase
                .from('gebruikers_rollen')
                .select('gebruikersnaam')
                .eq('gebruikersnaam', gebruikersnaam);
            
            if (bestaande && bestaande.length > 0) {
                toonBericht('message', 'Deze gebruikersnaam is al in gebruik', 'error');
                return;
            }
        } catch (err) {
            console.error('Fout bij check gebruikersnaam:', err);
        }
        
        try {
            // Account aanmaken in Supabase Auth
            const { data: authData, error: authError } = await window.supabase.auth.signUp({
                email: email,
                password: password
            });
            
            if (authError) {
                console.error('Auth error:', authError);
                toonBericht('message', 'Fout bij aanmaken account: ' + authError.message, 'error');
                return;
            }
            
            if (!authData.user) {
                toonBericht('message', 'Account kon niet worden aangemaakt. Probeer opnieuw.', 'error');
                return;
            }
            
            console.log('Auth account aangemaakt:', authData.user.id);
            
            // ===== STAP 1: Probeer via service_role key (veiligste manier) =====
            const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZHFjZ3Zpb3NzbXJ2bGdzaXFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTUwMTM4MCwiZXhwIjoyMDk3MDc3MzgwfQ.9bU82TwQuc5yViZPQfVAgyzCOTpVsPxfrhlDnL3rlqk'; // Vervang met jouw key!
            const supabaseUrl = 'https://jcdqcgviossmrvlgsiqd.supabase.co';
            
            try {
                const insertResponse = await fetch(`${supabaseUrl}/rest/v1/gebruikers_rollen`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        user_id: authData.user.id,
                        gebruikersnaam: gebruikersnaam,
                        rol: 'gebruiker',
                        is_chauffeur: false,
                        status: 'wachtend'
                    })
                });
                
                if (insertResponse.ok) {
                    console.log('Gebruiker toegevoegd via service_role key');
                    toonBericht('message', 
                        '✅ Account aanvraag ontvangen! Een administrator moet je account nog goedkeuren.', 
                        'success'
                    );
                    document.getElementById('registerUsername').value = '';
                    document.getElementById('registerEmail').value = '';
                    document.getElementById('registerPassword').value = '';
                    stuurAdminNotificatie(gebruikersnaam, email);
                    return;
                }
            } catch (serviceError) {
                console.error('Service role insert mislukt:', serviceError);
            }
            
            // ===== STAP 2: Fallback - Probeer via normale Supabase insert =====
            try {
                const { error: rolError } = await window.supabase
                    .from('gebruikers_rollen')
                    .insert([{
                        user_id: authData.user.id,
                        gebruikersnaam: gebruikersnaam,
                        rol: 'gebruiker',
                        is_chauffeur: false,
                        status: 'wachtend'
                    }]);
                
                if (rolError) {
                    console.error('Rol error:', rolError);
                    toonBericht('message', 
                        '⚠️ Account aangemaakt, maar kon niet worden gekoppeld. Neem contact op met de beheerder.\n\nFout: ' + rolError.message, 
                        'error'
                    );
                    return;
                }
                
                console.log('Gebruiker toegevoegd aan gebruikers_rollen via fallback');
                toonBericht('message', 
                    '✅ Account aanvraag ontvangen! Een administrator moet je account nog goedkeuren.', 
                    'success'
                );
                document.getElementById('registerUsername').value = '';
                document.getElementById('registerEmail').value = '';
                document.getElementById('registerPassword').value = '';
                stuurAdminNotificatie(gebruikersnaam, email);
                
            } catch (err) {
                console.error('Fallback insert fout:', err);
                toonBericht('message', 'Fout bij koppelen account: ' + err.message, 'error');
            }
            
        } catch (err) {
            console.error('Registratie fout:', err);
            toonBericht('message', 'Fout: ' + err.message, 'error');
        }
    };
}
    
    // Admin notificatie functie
    async function stuurAdminNotificatie(gebruikersnaam, email) {
        console.log(`🔔 Nieuwe registratie: ${gebruikersnaam} (${email})`);
        console.log('📋 Ga naar admin panel om goed te keuren.');
    }
    
    // ===== INLOGGEN (met status check) =====
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
                    redirectTo: window.location.origin + '/Project/reset-password.html'
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
    
    // Enter toets voor inloggen
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (loginForm && loginForm.classList.contains('active')) {
                if (loginBtn) loginBtn.click();
            } else if (registerForm && registerForm.classList.contains('active')) {
                if (registerBtn) registerBtn.click();
            }
        }
    });
    
});