// ============================================================
// CORE - SUPABASE (Centrale databaseverbinding)
// ============================================================

// ===== CONFIGURATIE =====
const SUPABASE_URL = 'https://jcdqcgviossmrvlgsiqd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BhTGDyLsGeHEMConkTeqcg_LHK5pLoG';

// ===== SUPABASE CLIENT =====
export const supabase = window.supabase;
if (!supabase) {
  console.error('❌ Supabase niet gevonden!');
  throw new Error('Supabase client niet beschikbaar');
}
console.log('✅ Supabase client geladen via window.supabase');

// ===== AUTHENTICATIE FUNCTIES =====
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

export async function register(email, password, gebruikersnaam) {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error('Account kon niet worden aangemaakt');

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

export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

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

export async function isAdmin(userId) {
  const result = await getUserRole(userId);
  return result.rol === 'admin';
}

// ===== DATABASE FUNCTIES =====
export async function dbSelect(table, options = {}) {
  try {
    let query = supabase.from(table).select(options.select || '*');
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
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

// ============================================================
// 🔥 LOG ACTIE FUNCTIE (TOEGEVOEGD)
// ============================================================
export async function logActie(actie, module, entityId = null, entityNaam = null, details = null) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.warn('⚠️ Geen gebruiker ingelogd, log wordt niet opgeslagen');
      return;
    }

    const logData = {
      user_id: user.id,
      actie: actie,
      module: module,
      entity_id: entityId ? String(entityId) : null,
      entity_naam: entityNaam,
      details: details ? JSON.stringify(details) : null
    };

    const { error } = await supabase
      .from('activiteitenlog')
      .insert([logData]);

    if (error) {
      console.error('❌ Fout bij loggen:', error);
    } else {
      console.log(`✅ Gelogd: ${actie} in ${module}`);
    }
  } catch (err) {
    console.warn('⚠️ Fout bij loggen:', err);
  }
}

// ===== EXPORT ALLES =====
export default supabase;