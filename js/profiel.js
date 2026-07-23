// ============================================================
// PROFIEL - Gebruikersprofiel pagina (profiel.html)
// ============================================================

console.log('🚀 profiel.js wordt geladen...');

import { requireAuth, toonGebruikersnaam, logoutUser, updateUserPassword } from './core/auth.js';
import { showToast, escapeHtml, formatDate } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== DOM ELEMENTEN =====
const profielEmail = document.getElementById('profielEmail');
const profielAangemaakt = document.getElementById('profielAangemaakt');
const profielLaatsteInlog = document.getElementById('profielLaatsteInlog');
const huidigWachtwoord = document.getElementById('huidigWachtwoord');
const nieuwWachtwoord = document.getElementById('nieuwWachtwoord');
const bevestigWachtwoord = document.getElementById('bevestigWachtwoord');
const updateWachtwoordBtn = document.getElementById('updateWachtwoordBtn');
const logoutBtnProfiel = document.getElementById('logoutBtnProfiel');

console.log('✅ DOM elementen gevonden');

// ===== PROFIEL LADEN =====
async function laadProfiel() {
    console.log('👤 Profiel laden...');
    
    try {
        // Haal de huidige gebruiker op
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('❌ Fout bij ophalen gebruiker:', userError);
            showToast('Fout bij ophalen gebruiker: ' + userError.message, 'error');
            return;
        }
        
        if (!user) {
            console.warn('⚠️ Geen gebruiker ingelogd');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('✅ Gebruiker gevonden:', user.email);
        
        // Toon e-mail
        if (profielEmail) {
            profielEmail.textContent = user.email || 'Onbekend';
        }
        
        // Toon aanmaakdatum
        if (profielAangemaakt) {
            const created = user.created_at ? new Date(user.created_at) : null;
            profielAangemaakt.textContent = created ? created.toLocaleDateString('nl-NL', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Onbekend';
        }
        
        // Toon laatste inlog (als die er is)
        if (profielLaatsteInlog) {
            // Supabase geeft geen directe laatste inlog, we gebruiken de updated_at van de gebruiker
            const updated = user.updated_at ? new Date(user.updated_at) : null;
            profielLaatsteInlog.textContent = updated ? updated.toLocaleDateString('nl-NL', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Onbekend';
        }
        
        // Haal ook de gebruikersnaam op
        toonGebruikersnaam(user.id, 'userEmail');
        
        console.log('✅ Profiel geladen');
    } catch (err) {
        console.error('❌ Fout bij laden profiel:', err);
        showToast('Fout bij laden profiel: ' + err.message, 'error');
    }
}

// ===== WACHTWOORD WIJZIGEN =====
async function updateWachtwoord() {
    const huidig = huidigWachtwoord?.value || '';
    const nieuw = nieuwWachtwoord?.value || '';
    const bevestig = bevestigWachtwoord?.value || '';
    
    // Validatie
    if (!huidig) {
        showToast('Vul je huidige wachtwoord in', 'error');
        return;
    }
    
    if (!nieuw) {
        showToast('Vul een nieuw wachtwoord in', 'error');
        return;
    }
    
    if (nieuw.length < 6) {
        showToast('Wachtwoord moet minimaal 6 tekens zijn', 'error');
        return;
    }
    
    if (nieuw !== bevestig) {
        showToast('Wachtwoorden komen niet overeen', 'error');
        return;
    }
    
    // Eerst verifiëren we het huidige wachtwoord door opnieuw in te loggen
    try {
        // Haal de huidige gebruiker op
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('Je bent niet ingelogd', 'error');
            return;
        }
        
        // Verifieer het huidige wachtwoord door opnieuw in te loggen
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: huidig
        });
        
        if (signInError) {
            showToast('❌ Huidig wachtwoord is onjuist', 'error');
            return;
        }
        
        // Update het wachtwoord
        const result = await updateUserPassword(nieuw);
        
        if (result.error) {
            showToast('❌ Fout bij wijzigen wachtwoord: ' + result.error.message, 'error');
            return;
        }
        
        // Leeg de velden
        if (huidigWachtwoord) huidigWachtwoord.value = '';
        if (nieuwWachtwoord) nieuwWachtwoord.value = '';
        if (bevestigWachtwoord) bevestigWachtwoord.value = '';
        
        showToast('✅ Wachtwoord succesvol gewijzigd!', 'success');
        
    } catch (err) {
        console.error('❌ Fout bij wijzigen wachtwoord:', err);
        showToast('❌ Fout bij wijzigen wachtwoord: ' + err.message, 'error');
    }
}

// ===== UITLOGGEN =====
async function logout() {
    if (confirm('Weet je zeker dat je wilt uitloggen?')) {
        await logoutUser('index.html');
    }
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Profiel pagina initialiseren...');
    
    // Controleer of gebruiker is ingelogd
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    // Laad profiel
    await laadProfiel();
    
    // ===== EVENT LISTENERS =====
    
    // Wachtwoord wijzigen knop
    if (updateWachtwoordBtn) {
        updateWachtwoordBtn.addEventListener('click', updateWachtwoord);
    }
    
    // Enter toets op wachtwoord velden
    if (huidigWachtwoord) {
        huidigWachtwoord.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (nieuwWachtwoord) nieuwWachtwoord.focus();
            }
        });
    }
    
    if (nieuwWachtwoord) {
        nieuwWachtwoord.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (bevestigWachtwoord) bevestigWachtwoord.focus();
            }
        });
    }
    
    if (bevestigWachtwoord) {
        bevestigWachtwoord.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (updateWachtwoordBtn) updateWachtwoordBtn.click();
            }
        });
    }
    
    // Uitloggen knop
    if (logoutBtnProfiel) {
        logoutBtnProfiel.addEventListener('click', logout);
    }
    
    console.log('✅ Profiel pagina geïnitialiseerd!');
});

console.log('✅ profiel.js geladen!');