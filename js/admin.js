// ============================================================
// ADMIN - Admin panel (admin.html)
// ============================================================
import { requireAdmin, getGebruikersnaam, logoutUser } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase, logActie } from './core/supabase.js';

console.log('🚀 admin.js geladen');

// ===== DOM ELEMENTEN =====
const addUserBtn = document.getElementById('addUserBtn');
const userPopup = document.getElementById('userPopup');
const closeUserPopup = document.getElementById('closeUserPopup');
const saveUserBtn = document.getElementById('saveUserBtn');
const userPopupTitle = document.getElementById('userPopupTitle');
const gebruikersLijst = document.getElementById('gebruikersLijst');
const chauffeursLijst = document.getElementById('chauffeursLijst');
const searchUserInput = document.getElementById('searchUserInput');
const clearUserSearchBtn = document.getElementById('clearUserSearchBtn');
const searchChauffeurInput = document.getElementById('searchChauffeurInput');
const clearChauffeurSearchBtn = document.getElementById('clearChauffeurSearchBtn');
const addChauffeurBtn = document.getElementById('addChauffeurBtn');
const chauffeurPopup = document.getElementById('chauffeurPopup');
const chauffeurPopupTitle = document.getElementById('chauffeurPopupTitle');
const chauffeurNummerInput = document.getElementById('chauffeurNummerInput');
const chauffeurNaam = document.getElementById('chauffeurNaam');
const chauffeurTelefoonInput = document.getElementById('chauffeurTelefoonInput');
const chauffeurEmail = document.getElementById('chauffeurEmail');
const chauffeurWhatsapp = document.getElementById('chauffeurWhatsapp');
const chauffeurActief = document.getElementById('chauffeurActief');
const saveChauffeurBtn = document.getElementById('saveChauffeurBtn');
const closeChauffeurPopup = document.getElementById('closeChauffeurPopup');
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
let currentChauffeurId = null;
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

// ============================================================
// TABS FUNCTIE
// ============================================================
function initTabs() {
  console.log('🔍 Tabs initialiseren...');
  const tabs = document.querySelectorAll('.tab-btn');
  console.log(`📋 ${tabs.length} tabs gevonden`);
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`🔄 Tab geklikt: ${this.dataset.tab}`);
      
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab').forEach(p => p.classList.remove('active'));
      
      this.classList.add('active');
      const tabName = this.dataset.tab;
      const paneId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
      const pane = document.getElementById(paneId);
      if (pane) {
        pane.classList.add('active');
        console.log(`✅ Pane geactiveerd: ${paneId}`);
      } else {
        console.warn(`⚠️ Pane niet gevonden: ${paneId}`);
      }
    });
  });
}

// ============================================================
// GEBRUIKERS FUNCTIES
// ============================================================

async function laadGebruikers() {
  console.log('🔄 laadGebruikers aangeroepen');
  if (!gebruikersLijst) return;
  gebruikersLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    const { data: rollen, error: rollenError } = await supabase
      .from('gebruikers_rollen')
      .select('*')
      .order('created_at', { ascending: false });

    if (rollenError) throw rollenError;

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
    }

    let html = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left;">Gebruikersnaam</th>
              <th style="padding: 12px; text-align: left;">E-mail</th>
              <th style="padding: 12px; text-align: left;">Rol</th>
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

    // ===== GOEDKEUREN =====
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userid;
        if (!confirm('Weet je zeker dat je deze gebruiker wilt goedkeuren?')) return;
        
        const row = btn.closest('tr');
        const gebruikersnaam = row?.querySelector('td:first-child')?.textContent || 'Onbekend';

        const { error } = await supabase
          .from('gebruikers_rollen')
          .update({ status: 'goedgekeurd' })
          .eq('user_id', userId);

        if (error) {
          showToast('Fout: ' + error.message, 'error');
        } else {
          await logActie('goedgekeurd', 'gebruikers', userId, gebruikersnaam);
          showToast('✅ Gebruiker goedgekeurd!', 'success');
          laadGebruikers();
          laadChauffeurs();
          laadStatistieken();
        }
      });
    });

    // ===== WEIGEREN =====
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userid;
        if (!confirm('Weet je zeker dat je deze gebruiker wilt weigeren?')) return;
        
        const row = btn.closest('tr');
        const gebruikersnaam = row?.querySelector('td:first-child')?.textContent || 'Onbekend';

        const { error } = await supabase
          .from('gebruikers_rollen')
          .update({ status: 'geweigerd' })
          .eq('user_id', userId);

        if (error) {
          showToast('Fout: ' + error.message, 'error');
        } else {
          await logActie('geweigerd', 'gebruikers', userId, gebruikersnaam);
          showToast('❌ Gebruiker geweigerd.', 'error');
          laadGebruikers();
          laadChauffeurs();
          laadStatistieken();
        }
      });
    });

    // ===== BEWERKEN =====
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkGebruiker(btn.dataset.userid));
    });

    // ===== VERWIJDEREN =====
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderGebruiker(btn.dataset.userid));
    });

  } catch (err) {
    console.error('❌ Fout bij laden gebruikers:', err);
    gebruikersLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

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
    userPopup.style.display = 'flex';
  } catch (err) {
    showToast('Fout: ' + err.message, 'error');
  }
}

async function saveUser() {
  const gebruikersnaam = getValue('userGebruikersnaam');
  const email = getValue('userEmail');
  const password = getValue('userPassword');
  const rol = getValue('userRol');

  if (!gebruikersnaam) {
    showToast('Vul een gebruikersnaam in', 'error');
    return;
  }

  try {
    const userData = {
      gebruikersnaam: gebruikersnaam,
      rol: rol,
      status: 'goedgekeurd'
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
          ...userData
        }]);
    }

    if (result.error) throw result.error;

    const userId = currentEditingUserId || nieuweUserId || result.data?.[0]?.user_id;

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

async function verwijderGebruiker(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (userId === user.id) {
    showToast('Je kunt jezelf niet verwijderen!', 'error');
    return;
  }
  if (!confirm('⚠️ Weet je zeker dat je deze gebruiker volledig wilt verwijderen?')) return;

  const row = document.querySelector(`tr[data-userid="${userId}"]`);
  const gebruikersnaam = row?.querySelector('td:first-child')?.textContent || 'Onbekend';

  try {
    showToast('🔄 Bezig met verwijderen...', 'info');

    await supabase.from('gebruikers_module_rechten').delete().eq('user_id', userId);
    await supabase.from('gebruikers_rollen').delete().eq('user_id', userId);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Je bent niet ingelogd.');

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
    if (!response.ok) throw new Error(result.error || 'Fout bij verwijderen uit auth');

    await logActie('verwijderd', 'gebruikers', userId, gebruikersnaam);
    showToast('✅ Gebruiker verwijderd!', 'success');
    laadGebruikers();
    laadChauffeurs();
    laadStatistieken();
  } catch (err) {
    console.error('❌ Fout bij verwijderen:', err);
    showToast('❌ Fout bij verwijderen: ' + err.message, 'error');
  }
}

// ============================================================
// CHAUFFEURS FUNCTIES
// ============================================================

async function laadChauffeurs() {
  console.log('🔄 laadChauffeurs aangeroepen');
  if (!chauffeursLijst) return;
  chauffeursLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    const { data, error } = await supabase
      .from('chauffeurs')
      .select('*')
      .order('naam');

    if (error) throw error;

    if (!data || data.length === 0) {
      chauffeursLijst.innerHTML = '<p>Geen chauffeurs gevonden. Klik op "+ Nieuwe chauffeur" om er een toe te voegen.</p>';
      if (aantalChauffeursSpan) aantalChauffeursSpan.textContent = '0';
      return;
    }

    alleChauffeurs = data;
    if (aantalChauffeursSpan) aantalChauffeursSpan.textContent = data.length;

    let gefilterdeChauffeurs = data;
    if (huidigeChauffeurZoekterm) {
      const term = huidigeChauffeurZoekterm.toLowerCase();
      gefilterdeChauffeurs = data.filter(c => 
        (c.naam && c.naam.toLowerCase().includes(term)) ||
        (c.chauffeursnummer && c.chauffeursnummer.toLowerCase().includes(term)) ||
        (c.telefoon && c.telefoon.toLowerCase().includes(term))
      );
    }

    let html = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left;">Nr.</th>
              <th style="padding: 12px; text-align: left;">Naam</th>
              <th style="padding: 12px; text-align: left;">Telefoon</th>
              <th style="padding: 12px; text-align: left;">E-mail</th>
              <th style="padding: 12px; text-align: left;">WhatsApp</th>
              <th style="padding: 12px; text-align: left;">Status</th>
              <th style="padding: 12px; text-align: left;">Acties</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const chauffeur of gefilterdeChauffeurs) {
      const statusDisplay = chauffeur.actief ? '✅ Actief' : '❌ Inactief';
      
      html += `
        <tr style="border-bottom: 1px solid #e9ecef;" data-chauffeurid="${chauffeur.id}">
          <td style="padding: 12px;"><strong>${escapeHtml(chauffeur.chauffeursnummer)}</strong></td>
          <td style="padding: 12px;">${escapeHtml(chauffeur.naam)}</td>
          <td style="padding: 12px;">${escapeHtml(chauffeur.telefoon || '-')}</td>
          <td style="padding: 12px;">${escapeHtml(chauffeur.email || '-')}</td>
          <td style="padding: 12px;">${escapeHtml(chauffeur.whatsapp || '-')}</td>
          <td style="padding: 12px;">${statusDisplay}</td>
          <td style="padding: 12px;" class="admin-buttons">
            <button class="btn btn-secondary edit-chauffeur-btn" data-id="${chauffeur.id}">✏️ Bewerken</button>
            <button class="btn btn-danger delete-chauffeur-btn" data-id="${chauffeur.id}">🗑️ Verwijderen</button>
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
      btn.addEventListener('click', () => bewerkChauffeur(btn.dataset.id));
    });

    document.querySelectorAll('.delete-chauffeur-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderChauffeur(btn.dataset.id));
    });

  } catch (err) {
    console.error('❌ Fout bij laden chauffeurs:', err);
    chauffeursLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

function resetChauffeurPopup() {
  setValue('chauffeurNummerInput', '');
  setValue('chauffeurNaam', '');
  setValue('chauffeurTelefoonInput', '');
  setValue('chauffeurEmail', '');
  setValue('chauffeurWhatsapp', '');
  setValue('chauffeurActief', 'true');
}

async function bewerkChauffeur(id) {
  try {
    const { data, error } = await supabase
      .from('chauffeurs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentChauffeurId = id;
    chauffeurPopupTitle.textContent = 'Chauffeur bewerken';
    setValue('chauffeurNummerInput', data.chauffeursnummer);
    setValue('chauffeurNaam', data.naam);
    setValue('chauffeurTelefoonInput', data.telefoon || '');
    setValue('chauffeurEmail', data.email || '');
    setValue('chauffeurWhatsapp', data.whatsapp || '');
    setValue('chauffeurActief', data.actief ? 'true' : 'false');

    chauffeurPopup.style.display = 'flex';
  } catch (err) {
    console.error('Fout bij bewerken chauffeur:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

async function saveChauffeur() {
  const nummer = getValue('chauffeurNummerInput');
  const naam = getValue('chauffeurNaam');
  const telefoon = getValue('chauffeurTelefoonInput') || null;
  const email = getValue('chauffeurEmail') || null;
  const whatsapp = getValue('chauffeurWhatsapp') || null;
  const actief = getValue('chauffeurActief') === 'true';

  if (!nummer || !naam) {
    showToast('Vul chauffeursnummer en naam in', 'error');
    return;
  }

  const chauffeurData = {
    chauffeursnummer: nummer,
    naam: naam,
    telefoon: telefoon,
    email: email,
    whatsapp: whatsapp,
    actief: actief
  };

  try {
    let result;
    const isBewerken = !!currentChauffeurId;

    if (isBewerken) {
      result = await supabase
        .from('chauffeurs')
        .update(chauffeurData)
        .eq('id', currentChauffeurId);
    } else {
      result = await supabase
        .from('chauffeurs')
        .insert([chauffeurData]);
    }

    if (result.error) throw result.error;

    const actie = isBewerken ? 'bijgewerkt' : 'toegevoegd';
    const entityId = isBewerken ? currentChauffeurId : result.data?.[0]?.id;
    await logActie(actie, 'chauffeurs', entityId, naam);

    showToast('✅ Chauffeur opgeslagen!', 'success');
    chauffeurPopup.style.display = 'none';
    currentChauffeurId = null;
    resetChauffeurPopup();
    laadChauffeurs();
    laadStatistieken();
  } catch (err) {
    console.error('Fout bij opslaan chauffeur:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

async function verwijderChauffeur(id) {
  if (!confirm('Weet je zeker dat je deze chauffeur wilt verwijderen?')) return;

  try {
    const { error } = await supabase
      .from('chauffeurs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logActie('verwijderd', 'chauffeurs', id);
    showToast('✅ Chauffeur verwijderd!', 'success');
    laadChauffeurs();
    laadStatistieken();
  } catch (err) {
    console.error('Fout bij verwijderen chauffeur:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ============================================================
// STATISTIEKEN
// ============================================================

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

// ============================================================
// INITIALISATIE
// ============================================================

async function initAdmin() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('🔄 Admin initialisatie gestart...');

  const isAdmin = await requireAdmin('dashboard.html');
  if (!isAdmin) {
    console.warn('⚠️ Geen admin rechten, redirect...');
    return;
  }

  console.log('✅ Admin rechten bevestigd');

  // Reset zoektermen
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

  // Initialiseer tabs
  initTabs();

  // Laad data
  await laadGebruikers();
  await laadChauffeurs();
  await laadStatistieken();

  // Zorg dat de eerste tab actief is
  const firstTab = document.querySelector('.tab-btn');
  if (firstTab) {
    firstTab.click();
  }

  // ===== EVENT LISTENERS =====

  // Gebruiker toevoegen
  if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
      currentEditingUserId = null;
      userPopupTitle.textContent = 'Nieuwe gebruiker';
      setValue('userGebruikersnaam', '');
      setValue('userEmail', '');
      setValue('userPassword', '');
      setValue('userRol', 'gebruiker');
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

  // Chauffeur toevoegen
  if (addChauffeurBtn) {
    addChauffeurBtn.addEventListener('click', () => {
      currentChauffeurId = null;
      chauffeurPopupTitle.textContent = 'Nieuwe chauffeur';
      resetChauffeurPopup();
      chauffeurPopup.style.display = 'flex';
    });
  }

 