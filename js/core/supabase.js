// ============================================================
// CORE - SUPABASE (Centrale databaseverbinding)
// ============================================================

// ===== CONFIGURATIE =====
const SUPABASE_URL = 'https://jcdqcgviossmrvlgsiqd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BhTGDyLsGeHEMConkTeqcg_LHK5pLoG';

// ===== SUPABASE CLIENT =====
// Gebruik de bestaande window.supabase van de CDN script tag
// Deze wordt geladen via <script src="..."> in de HTML
export const supabase = window.supabase;

// Controleer of Supabase beschikbaar is
if (!supabase) {
    console.error('❌ Supabase niet gevonden! Zorg dat de script tag in je HTML staat.');
    throw new Error('Supabase client niet beschikbaar');
}

console.log('✅ Supabase client geladen via window.supabase');

// ===== AUTHENTICATIE FUNCTIES =====

/**
 * Haal de huidige gebruiker op
 * @returns {Promise<Object|null>} Gebruiker object of null
 */
export async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (err) {
        console.warn('Geen gebruiker ingelogd:', err.message);
        return null;
    }
}

/**
 * Haal de huidige sessie op
 * @returns {Promise<Object|null>} Sessie object of null
 */
export async function getCurrentSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    } catch (err) {
        console.warn('Geen sessie gevonden:', err.message);
        return null;
    }
}

/**
 * Log een gebruiker in
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} { user, error }
 */
export async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        return { user: data.user, error: null };
    } catch (err) {
        return { user: null, error: err };
    }
}

/**
 * Registreer een nieuwe gebruiker
 * @param {string} email 
 * @param {string} password 
 * @param {string} gebruikersnaam 
 * @returns {Promise<Object>} { user, error }
 */
export async function register(email, password, gebruikersnaam) {
    try {
        // Stap 1: Maak auth account aan
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Account kon niet worden aangemaakt');

        // Stap 2: Voeg gebruiker toe aan gebruikers_rollen
        const { error: rolError } = await supabase
            .from('gebruikers_rollen')
            .insert([{
                user_id: authData.user.id,
                gebruikersnaam: gebruikersnaam,
                rol: 'gebruiker',
                is_chauffeur: false,
                status: 'wachtend'
            }]);

        if (rolError) throw rolError;

        return { user: authData.user, error: null };
    } catch (err) {
        return { user: null, error: err };
    }
}

/**
 * Log een gebruiker uit
 * @returns {Promise<Object>} { error }
 */
export async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { error: null };
    } catch (err) {
        return { error: err };
    }
}

/**
 * Stuur een wachtwoord reset link
 * @param {string} email 
 * @param {string} redirectUrl 
 * @returns {Promise<Object>} { error }
 */
export async function resetPassword(email, redirectUrl = window.location.origin + '/reset-password.html') {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });
        if (error) throw error;
        return { error: null };
    } catch (err) {
        return { error: err };
    }
}

/**
 * Update het wachtwoord van de ingelogde gebruiker
 * @param {string} newPassword 
 * @returns {Promise<Object>} { error }
 */
export async function updatePassword(newPassword) {
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        if (error) throw error;
        return { error: null };
    } catch (err) {
        return { error: err };
    }
}

// ===== GEBRUIKERS ROLLEN FUNCTIES =====

/**
 * Haal de rol van een gebruiker op
 * @param {string} userId 
 * @returns {Promise<Object>} { rol, status, error }
 */
export async function getUserRole(userId) {
    try {
        const { data, error } = await supabase
            .from('gebruikers_rollen')
            .select('rol, status, gebruikersnaam, is_chauffeur')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return { ...data, error: null };
    } catch (err) {
        return { rol: null, status: null, error: err };
    }
}

/**
 * Haal de gebruikersnaam op van een gebruiker
 * @param {string} userId 
 * @returns {Promise<string>} Gebruikersnaam of 'Gebruiker'
 */
export async function getUsername(userId) {
    try {
        const { data, error } = await supabase
            .from('gebruikers_rollen')
            .select('gebruikersnaam')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data?.gebruikersnaam || 'Gebruiker';
    } catch (err) {
        return 'Gebruiker';
    }
}

/**
 * Controleer of een gebruiker admin is
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
export async function isAdmin(userId) {
    const result = await getUserRole(userId);
    return result.rol === 'admin';
}

// ===== DATABASE FUNCTIES =====

/**
 * Voer een generieke SELECT query uit
 * @param {string} table - Tabel naam
 * @param {Object} options - { select, filters, order, limit, single }
 * @returns {Promise<Object>} { data, error }
 */
export async function dbSelect(table, options = {}) {
    try {
        let query = supabase.from(table).select(options.select || '*');

        // Filters toepassen (object van { column: value })
        if (options.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }

        // Order toepassen (array van [column, ascending])
        if (options.order) {
            const [column, ascending = true] = options.order;
            query = query.order(column, { ascending: ascending });
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        if (options.single) {
            query = query.single();
        }

        const { data, error } = await query;
        if (error) throw error;
        return { data, error: null };
    } catch (err) {
        return { data: null, error: err };
    }
}

/**
 * Voer een INSERT query uit
 * @param {string} table - Tabel naam
 * @param {Object|Array} data - Data om in te voegen
 * @returns {Promise<Object>} { data, error }
 */
export async function dbInsert(table, data) {
    try {
        const { data: result, error } = await supabase
            .from(table)
            .insert(data)
            .select();

        if (error) throw error;
        return { data: result, error: null };
    } catch (err) {
        return { data: null, error: err };
    }
}

/**
 * Voer een UPDATE query uit
 * @param {string} table - Tabel naam
 * @param {Object} data - Data om te updaten
 * @param {Object} match - Match conditie { column: value }
 * @returns {Promise<Object>} { data, error }
 */
export async function dbUpdate(table, data, match) {
    try {
        let query = supabase.from(table).update(data);

        Object.entries(match).forEach(([key, value]) => {
            query = query.eq(key, value);
        });

        const { data: result, error } = await query.select();
        if (error) throw error;
        return { data: result, error: null };
    } catch (err) {
        return { data: null, error: err };
    }
}

/**
 * Voer een DELETE query uit
 * @param {string} table - Tabel naam
 * @param {Object} match - Match conditie { column: value }
 * @returns {Promise<Object>} { error }
 */
export async function dbDelete(table, match) {
    try {
        let query = supabase.from(table).delete();

        Object.entries(match).forEach(([key, value]) => {
            query = query.eq(key, value);
        });

        const { error } = await query;
        if (error) throw error;
        return { error: null };
    } catch (err) {
        return { error: err };
    }
}

// ===== LOG FUNCTIES =====

/**
 * Log een actie in het activiteitenlog
 * @param {string} actie - Bijv. 'toegevoegd', 'bijgewerkt'
 * @param {string} module - Bijv. 'adressen', 'planning'
 * @param {string} entityId - ID van de entiteit
 * @param {string} entityNaam - Naam van de entiteit
 * @param {Object} details - Extra details (wordt JSON)
 */
export async function logActie(actie, module, entityId = null, entityNaam = null, details = null) {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        const logData = {
            user_id: user.id,
            actie: actie,
            module: module,
            entity_id: entityId ? String(entityId) : null,
            entity_naam: entityNaam,
            details: details ? JSON.stringify(details) : null
        };

        await supabase
            .from('activiteitenlog')
            .insert([logData]);
    } catch (err) {
        console.warn('Fout bij loggen:', err);
    }
}

// ===== EXPORT ALLES =====
export default supabase;