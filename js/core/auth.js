// ============================================================
// CORE - AUTH (Authenticatie functies)
// ============================================================

import { supabase, getCurrentUser, getCurrentSession, login, register, logout, resetPassword, updatePassword, getUserRole, isAdmin } from './supabase.js';
import { showToast } from './utils.js';

// ===== AUTH STATUS =====

/**
 * Controleer of de gebruiker is ingelogd en goedgekeurd
 * @returns {Promise<Object>} { isAuthenticated, user, status, error }
 */
export async function checkAuthStatus() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return { isAuthenticated: false, user: null, status: null, error: null };
        }

        const roleInfo = await getUserRole(user.id);
        if (roleInfo.error) {
            return { isAuthenticated: false, user: null, status: null, error: roleInfo.error };
        }

        return {
            isAuthenticated: true,
            user: user,
            status: roleInfo.status || 'goedgekeurd',
            rol: roleInfo.rol || 'gebruiker',
            error: null
        };
    } catch (err) {
        return { isAuthenticated: false, user: null, status: null, error: err };
    }
}

/**
 * Controleer of de gebruiker is ingelogd en goedgekeurd (redirect bij fout)
 * @param {string} redirectUrl - URL om naartoe te redirecten bij fout
 * @returns {Promise<Object>} { isAuthenticated, user, status, rol }
 */
export async function requireAuth(redirectUrl = 'index.html') {
    const authStatus = await checkAuthStatus();
    
    if (!authStatus.isAuthenticated) {
        window.location.href = redirectUrl;
        return { isAuthenticated: false, user: null };
    }

    if (authStatus.status !== 'goedgekeurd') {
        await logout();
        showToast('Je account is nog niet goedgekeurd door een administrator.', 'error');
        window.location.href = redirectUrl;
        return { isAuthenticated: false, user: null };
    }

    return authStatus;
}

/**
 * Controleer of de gebruiker admin is (redirect bij fout)
 * @param {string} redirectUrl - URL om naartoe te redirecten bij fout
 * @returns {Promise<boolean>}
 */
export async function requireAdmin(redirectUrl = 'dashboard.html') {
    const authStatus = await requireAuth(redirectUrl);
    if (!authStatus.isAuthenticated) return false;

    if (authStatus.rol !== 'admin') {
        showToast('Je hebt geen toegang tot deze pagina. Alleen admins kunnen hier komen.', 'error');
        window.location.href = redirectUrl;
        return false;
    }

    return true;
}

// ===== LOGIN FUNCTIES =====

/**
 * Log een gebruiker in met e-mail en wachtwoord
 * @param {string} email 
 * @param {string} password 
 * @param {string} redirectUrl - URL na succesvol inloggen
 * @returns {Promise<Object>} { success, error }
 */
export async function loginUser(email, password, redirectUrl = 'dashboard.html') {
    try {
        const result = await login(email, password);
        if (result.error) {
            return { success: false, error: result.error };
        }

        // Controleer de status van de gebruiker
        const roleInfo = await getUserRole(result.user.id);
        if (roleInfo.error) {
            await logout();
            return { success: false, error: { message: 'Account niet gevonden. Neem contact op met de beheerder.' } };
        }

        if (roleInfo.status === 'wachtend') {
            await logout();
            return { success: false, error: { message: '⏳ Je account wacht nog op goedkeuring door een administrator.' } };
        }

        if (roleInfo.status === 'geweigerd') {
            await logout();
            return { success: false, error: { message: '❌ Je account is geweigerd. Neem contact op met de beheerder.' } };
        }

        // Alles goed, gebruiker mag inloggen
        showToast('✅ Ingelogd! Doorsturen...', 'success');
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);

        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: err };
    }
}

// ===== REGISTRATIE FUNCTIES =====

/**
 * Registreer een nieuwe gebruiker
 * @param {string} email 
 * @param {string} password 
 * @param {string} gebruikersnaam 
 * @returns {Promise<Object>} { success, error }
 */
export async function registerUser(email, password, gebruikersnaam) {
    try {
        // Controleer of gebruikersnaam al bestaat
        const { data: bestaande } = await supabase
            .from('gebruikers_rollen')
            .select('gebruikersnaam')
            .eq('gebruikersnaam', gebruikersnaam);

        if (bestaande && bestaande.length > 0) {
            return { success: false, error: { message: 'Deze gebruikersnaam is al in gebruik' } };
        }

        const result = await register(email, password, gebruikersnaam);
        if (result.error) {
            return { success: false, error: result.error };
        }

        showToast('✅ Account aanvraag ontvangen! Een administrator moet je account nog goedkeuren.', 'success');
        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: err };
    }
}

// ===== WACHTWOORD FUNCTIES =====

/**
 * Stuur een wachtwoord reset link
 * @param {string} email 
 * @param {string} redirectUrl 
 * @returns {Promise<Object>} { success, error }
 */
export async function resetPasswordUser(email, redirectUrl = window.location.origin + '/reset-password.html') {
    try {
        const result = await resetPassword(email, redirectUrl);
        if (result.error) {
            return { success: false, error: result.error };
        }
        showToast('📧 Resetlink verzonden! Controleer je e-mail.', 'success');
        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: err };
    }
}

/**
 * Update het wachtwoord van de ingelogde gebruiker
 * @param {string} newPassword 
 * @returns {Promise<Object>} { success, error }
 */
export async function updateUserPassword(newPassword) {
    try {
        const result = await updatePassword(newPassword);
        if (result.error) {
            return { success: false, error: result.error };
        }
        showToast('✅ Wachtwoord succesvol bijgewerkt!', 'success');
        return { success: true, error: null };
    } catch (err) {
        return { success: false, error: err };
    }
}

// ===== UITLOGGEN =====

/**
 * Log de gebruiker uit en redirect naar login
 * @param {string} redirectUrl 
 */
export async function logoutUser(redirectUrl = 'index.html') {
    await logout();
    window.location.href = redirectUrl;
}

// ===== HELPER FUNCTIES =====

/**
 * Toon de gebruikersnaam in een element
 * @param {string} userId 
 * @param {string} elementId 
 */
export async function toonGebruikersnaam(userId, elementId = 'userEmail') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const roleInfo = await getUserRole(userId);
    if (roleInfo.error) {
        element.textContent = 'Gebruiker';
        return;
    }
    element.textContent = roleInfo.gebruikersnaam || 'Gebruiker';
}

/**
 * Haal de gebruikersnaam op
 * @param {string} userId 
 * @returns {Promise<string>}
 */
export async function getGebruikersnaam(userId) {
    const roleInfo = await getUserRole(userId);
    return roleInfo.gebruikersnaam || 'Gebruiker';
}

// ===== EXPORT =====
export default {
    checkAuthStatus,
    requireAuth,
    requireAdmin,
    loginUser,
    registerUser,
    resetPasswordUser,
    updateUserPassword,
    logoutUser,
    toonGebruikersnaam,
    getGebruikersnaam
};