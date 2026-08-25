// ============================================================
// ADMIN - Admin panel (admin.html)
// ============================================================
import { requireAdmin, getGebruikersnaam, logoutUser } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase, logActie } from './core/supabase.js';  // 🔥 logActie toegevoegd

console.log('🚀 admin.js geladen');

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
let isInitialized = false;

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
  console.log('🔄 laadGebruikers aangeroepen');
  if (!gebruikersLijst) {
    console.warn('⚠️ gebruikersLijst element niet gevonden');
    return;
  }

  gebruikersLijst.innerHTML = '<p>Bezig met laden...</p>';
  console.log('📋 Laden gestart...');

  try {
    const { data: rollen, error: rollenError } = await supabase
      .from('gebruikers_rollen')
      .select('*')
      .order('created_at', { ascending: false });

    if (rollenError) throw rollenError;

    console.log('📊 Aantal rollen ontvangen:', rollen?.length || 0);

    if (!rollen || rollen.length === 0) {
      gebruikersLijst.innerHTML = '<p>Geen gebruikers gevonden.</p>';
      if (aantalGebruikersSpan) aantalGebruikersSpan.textContent = '0';
      return;
    }

    alleGebruikers = rollen;
    if (aantalGebruikersSpan) aantalGebruikersSpan.textContent = rollen.length;

    let gefilterdeRollen = rollen;
    if (huidigeUserZoekterm) {
      const term = huidigeUserZoekterm.toLowerCase();
      gefilterdeRollen = rollen.filter(rol => 
        (rol.gebruikersnaam && rol.gebruikersnaam.toLowerCase().includes(term)) ||
        (rol.user_id && rol.user_id.toLowerCase().includes(term)) ||
        (rol.rol && rol.rol.toLowerCase().includes(term)) ||
        (rol.status && rol.status.toLowerCase().includes(term))
      );
      console.log('🔍 Gefilterd op zoekterm:', huidigeUserZoekterm, 'aantal:', gefilterdeRollen.length);
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
    console.log('✅ Gebruikerslijst weergegeven, aantal rijen:', gefilterdeRollen.length);

    // ===== EVENT LISTENERS VOOR KNOBBEN =====

    // Goedkeuren
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userid;
        if (!confirm('Weet je zeker dat je deze gebruiker wilt goedkeuren?')) return;

        // 🔥 Haal gebruikersnaam op voor logging
        const row = btn.closest('tr');
        const gebruikersnaam = row?.querySelector('td:first-child')?.textContent || 'Onbekend';

        const { error } = await supabase
          .from('gebruikers_rollen')
          .update({ status: 'goedgekeurd' })
          .eq('user_id', userId);

        if (error) {
          showToast('Fout: ' + error.message, 'error');
        } else {
          // 🔥 LOG: Gebruiker goedgekeurd
          await logActie('goedgekeurd', 'gebruikers', userId, gebruikersnaam);
          showToast('✅ Gebruiker goedgekeurd!', 'success');
          laadGebruikers();
          laadChauffeurs();
        }
      });
    });

    // Weigeren
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userid;
        if (!confirm('Weet je zeker dat je deze gebruiker wilt weigeren?')) return;

        // 🔥 Haal gebruikersnaam op voor logging
        const row = btn.closest('tr');
        const gebruikersnaam = row?.querySelector('td:first-child')?.textContent || 'Onbekend';

        const { error } = await supabase
          .from('gebruikers_rollen')
          .update({ status: 'geweigerd' })
          .eq('user_id', userId);

        if (error) {
          showToast('Fout: ' + error.message, 'error');
        } else {
          // 🔥 LOG: Gebruiker geweigerd
          await logActie('geweigerd', 'gebruikers', userId, gebruikersnaam);
          showToast('❌ Gebruiker geweigerd.', 'error');
          laadGebruikers();
          laadChauffeurs();
        }
      });
    });

    // Bewerken
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkGebruiker(btn.dataset.userid));
    });

    // Verwijderen
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderGebruiker(btn.dataset.userid));
    });

  } catch (err) {
    console.error('❌ Fout bij laden gebruikers:', err);
    gebruikersLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== CHAUFFEURS LIJST LADEN =====
async function laadChauffeurs() {
  console.log('🔄 laadChauffeurs aangeroepen');
  if (!chauffeursLijst) {
    console.warn('⚠️ chauffeursLijst element niet gevonden');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('gebruikers_rollen')
      .select('*')
      .eq('is_chauffeur', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('📊 Aantal chauffeurs ontvangen:', data?.length || 0);

    if (!data || data.length === 0) {
      chauffeursLijst.innerHTML = '<p>Geen chauffeurs gevonden.</p>';
      if (aantalChauffeursSpan) aantalChauffeursSpan.textContent = '0';
      return;
    }

    alleChauffeurs = data;
    if (aantalChauffeursSpan) aantalChauffeursSpan.textContent = data.length;

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
    console.error('❌ Fout bij laden chauffeurs:', err);
    chauffeursLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== STATISTIEKEN LADEN =====
async function laadStatistieken() {
  try {
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
    chauffeurVelden.style.display = data.is_chauffeur ? 'block' : 'none';
    laadModuleRechten(userId);
    userPopup.style.display = 'flex';
  } catch (err) {
    showToast('Fout: ' + err.message, 'error');
  }
}

// ===== GEBRUIKER VERWIJDEREN =====
async function verwijderGebruiker(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (userId === user.id) {
    showToast('Je kunt jezelf niet verwijderen!', 'error');
    return;
  }
  if (!confirm('⚠️ Weet je zeker dat je deze gebruiker volledig wilt verwijderen?\n\nDit verwijdert:\n- De gebruiker uit auth.users\n- Alle rollen en rechten\n- Dit kan niet ongedaan worden gemaakt!')) return;

  // 🔥 Haal gebruikersnaam op voor logging
  const row = document.querySelector(`tr[data-userid="${userId}"]`);
  const gebruikersnaam = row?.querySelector('td:first-child')?.textContent || 'Onbekend';

  try {
    showToast('🔄 Bezig met verwijderen...', 'info');

    const { error: rechtError } = await supabase
      .from('gebruikers_module_rechten')
      .delete()
      .eq('user_id', userId);
    if (rechtError) {
      console.warn('⚠️ Kon rechten niet verwijderen:', rechtError);
    }

    const { error: rolError } = await supabase
      .from('gebruikers_rollen')
      .delete()
      .eq('user_id', userId);
    if (rolError) {
      throw new Error('Fout bij verwijderen rollen: ' + rolError.message);
    }
    console.log('✅ Gebruiker verwijderd uit gebruikers_rollen');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Je bent niet ingelogd. Log opnieuw in.');
    }

    const response = await fetch(
      'https://jcdqcgviossmrvlgsiqd.supabase.co/functions/v1/delete-user',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Fout bij verwijderen uit auth');
    }
    console.log('✅ Gebruiker verwijderd uit auth.users:', result);

    // 🔥 LOG: Gebruiker verwijderd
    await logActie('verwijderd', 'gebruikers', userId, gebruikersnaam);

    showToast('✅ Gebruiker volledig verwijderd!', 'success');
    laadGebruikers();
    laadChauffeurs();
    laadStatistieken();
  } catch (err) {
    console.error('❌ Fout bij verwijderen:', err);
    showToast('❌ Fout bij verwijderen: ' + err.message, 'error');
  }
}

// ===== MODULE RECHTEN LADEN =====
async function laadModuleRechten(userId) {
  const moduleContainer = document.getElementById('moduleRechtenContainer');
  if (!moduleContainer) return;

  try {
    const { data: modules, error: modError } = await supabase
      .from('modules')
      .select('*')
      .order('module_naam');
    if (modError) throw modError;

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
    let isNieuweGebruiker = false;
    let nieuweUserId = null;

    if (currentEditingUserId) {
      result = await supabase
        .from('gebruikers_rollen')
        .update(userData)
        .eq('user_id', currentEditingUserId);
    } else {
      isNieuweGebruiker = true;
      if (!email || !password) {
        showToast('Vul e-mail en wachtwoord in voor nieuwe gebruiker', 'error');
        return;
      }
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Account kon niet worden aangemaakt');

      nieuweUserId = authData.user.id;
      result = await supabase
        .from('gebruikers_rollen')
        .insert([{
          user_id: nieuweUserId,
          ...userData,
          status: 'goedgekeurd'
        }]);
    }

    if (result.error) throw result.error;

    const checkboxes = document.querySelectorAll('.module-recht-checkbox');
    const userId = currentEditingUserId || nieuweUserId || result.data?.[0]?.user_id;
    for (const checkbox of checkboxes) {
      const moduleSleutel = checkbox.dataset.module;
      const actief = checkbox.checked;
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

    // 🔥 LOG: Gebruiker toegevoegd of bijgewerkt
    if (isNieuweGebruiker) {
      await logActie('toegevoegd', 'gebruikers', userId, gebruikersnaam);
    } else {
      await logActie('bijgewerkt', 'gebruikers', userId, gebruikersnaam);
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
async function initAdmin() {
  if (isInitialized) {
    console.log('⚠️ Admin al geïnitialiseerd, overslaan');
    return;
  }
  isInitialized = true;

  console.log('🔄 Admin initialisatie gestart...');

  const isAdmin = await requireAdmin('dashboard.html');
  if (!isAdmin) {
    console.warn('⚠️ Geen admin rechten, redirect...');
    return;
  }

  console.log('✅ Admin rechten bevestigd');

  huidigeUserZoekterm = '';
  huidigeChauffeurZoekterm = '';
  if (searchUserInput) {
    searchUserInput.value = '';
    searchUserInput.setAttribute('autocomplete', 'off');
  }
  if (searchChauffeurInput) {
    searchChauffeurInput.value = '';
    searchChauffeurInput.setAttribute('autocomplete', 'off');
  }
  console.log('🔍 Zoektermen gereset, autocomplete uitgeschakeld');

  await laadGebruikers();
  await laadChauffeurs();
  await laadStatistieken();

  setTimeout(() => {
    if (searchUserInput && searchUserInput.value !== '') {
      console.log('🔄 Autocomplete detected, resetting zoekterm...');
      searchUserInput.value = '';
      huidigeUserZoekterm = '';
      laadGebruikers();
    }
    if (searchChauffeurInput && searchChauffeurInput.value !== '') {
      console.log('🔄 Autocomplete detected, resetting zoekterm...');
      searchChauffeurInput.value = '';
      huidigeChauffeurZoekterm = '';
      laadChauffeurs();
    }
  }, 200);

  // ===== EVENT LISTENERS =====
  if (userIsChauffeur) {
    userIsChauffeur.addEventListener('change', function() {
      chauffeurVelden.style.display = this.value === 'true' ? 'block' : 'none';
    });
  }

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
      const moduleContainer = document.getElementById('moduleRechtenContainer');
      if (moduleContainer) moduleContainer.innerHTML = '<p>Laden...</p>';
      userPopup.style.display = 'flex';
    });
  }

  if (saveUserBtn) {
    saveUserBtn.addEventListener('click', saveUser);
  }

  if (closeUserPopup) {
    closeUserPopup.addEventListener('click', () => {
      userPopup.style.display = 'none';
    });
  }

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

  if (saveStartpuntBtn && startpuntInstelling) {
    saveStartpuntBtn.addEventListener('click', () => {
      const startpunt = startpuntInstelling.value;
      localStorage.setItem('startpunt', startpunt);
      showToast('✅ Startpunt opgeslagen!', 'success');
    });
    const savedStartpunt = localStorage.getItem('startpunt');
    if (savedStartpunt) {
      startpuntInstelling.value = savedStartpunt;
    }
  }

  window.addEventListener('click', (e) => {
    if (e.target === userPopup) {
      userPopup.style.display = 'none';
    }
  });

  window.addEventListener('beforeunload', () => {
    if (searchUserInput) {
      searchUserInput.value = '';
    }
    if (searchChauffeurInput) {
      searchChauffeurInput.value = '';
    }
  });

  console.log('✅ Admin geïnitialiseerd!');
}

// ===== START =====
document.addEventListener('DOMContentLoaded', initAdmin);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('🔄 DOM al geladen, start admin direct...');
  initAdmin();
}

console.log('✅ admin.js geladen!');