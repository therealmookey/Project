// ===== PROFIEL FUNCTIES =====

document.addEventListener('DOMContentLoaded', async function() {
    
    if (!window.supabase) {
        console.error('Supabase niet beschikbaar!');
        return;
    }
    
    const profielEmail = document.getElementById('profielEmail');
    const profielAangemaakt = document.getElementById('profielAangemaakt');
    const profielLaatsteInlog = document.getElementById('profielLaatsteInlog');
    const updateWachtwoordBtn = document.getElementById('updateWachtwoordBtn');
    const logoutBtnProfiel = document.getElementById('logoutBtnProfiel');
    
    async function toonProfiel() {
        const { data: { user } } = await window.supabase.auth.getUser();
        if (user && profielEmail) {
            profielEmail.textContent = user.email;
            
            if (user.created_at) {
                profielAangemaakt.textContent = new Date(user.created_at).toLocaleDateString('nl-NL');
            }
            
            const { data: { session } } = await window.supabase.auth.getSession();
            if (session?.created_at) {
                profielLaatsteInlog.textContent = new Date(session.created_at).toLocaleDateString('nl-NL');
            }
        }
    }
    
    if (updateWachtwoordBtn) {
        updateWachtwoordBtn.addEventListener('click', async () => {
            const huidig = document.getElementById('huidigWachtwoord').value;
            const nieuw = document.getElementById('nieuwWachtwoord').value;
            const bevestig = document.getElementById('bevestigWachtwoord').value;
            
            if (!huidig || !nieuw || !bevestig) {
                alert('Vul alle wachtwoordvelden in');
                return;
            }
            
            if (nieuw !== bevestig) {
                alert('Nieuw wachtwoord en bevestiging komen niet overeen');
                return;
            }
            
            if (nieuw.length < 6) {
                alert('Nieuw wachtwoord moet minimaal 6 tekens zijn');
                return;
            }
            
            const { data: { user } } = await window.supabase.auth.getUser();
            const { error: signInError } = await window.supabase.auth.signInWithPassword({
                email: user.email,
                password: huidig
            });
            
            if (signInError) {
                alert('Huidig wachtwoord is onjuist');
                return;
            }
            
            const { error } = await window.supabase.auth.updateUser({
                password: nieuw
            });
            
            if (error) {
                alert('Fout bij updaten wachtwoord: ' + error.message);
            } else {
                alert('Wachtwoord succesvol bijgewerkt!');
                document.getElementById('huidigWachtwoord').value = '';
                document.getElementById('nieuwWachtwoord').value = '';
                document.getElementById('bevestigWachtwoord').value = '';
            }
        });
    }
    
    if (logoutBtnProfiel) {
        logoutBtnProfiel.addEventListener('click', async () => {
            await window.supabase.auth.signOut();
            window.location.href = 'index.html';
        });
    }
    
    toonProfiel();
    
});