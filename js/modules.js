// ============================================================
// MODULES - Module rechten beheer (modules.html)
// ============================================================
console.log('🚀 modules.js geladen');

import { requireAdmin } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase, logActie } from './core/supabase.js';

// ===== DOM ELEMENTEN =====
const gebruikersModuleLijst = document.getElementById('gebruikersModuleLijst');
const modulesLijst = document.getElementById('modulesLijst');
const searchModuleUserInput = document.getElementById('searchModuleUserInput');
const clearModuleUserSearchBtn = document.getElementById('clearModuleUserSearchBtn');
const searchModulesInput = document.getElementById('searchModulesInput');
const clearModulesSearchBtn = document.getElementById('clearModulesSearchBtn');
const addModuleBtn = document.getElementById('addModuleBtn');
const syncModuleDefaultsBtn = document.getElementById('syncModuleDefaultsBtn');
const refreshModulesBtn = document.getElementById('refreshModulesBtn');
const modulePopup = document.getElementById('modulePopup');
const modulePopupTitle = document.getElementById('modulePopupTitle');
const modulePopupUser = document.getElementById('modulePopupUser');
const moduleCheckboxes = document.getElementById('moduleCheckboxes');
const saveModuleRightsBtn = document.getElementById('saveModuleRightsBtn');
const closeModulePopup = document.getElementById('closeModulePopup');
const moduleEditPopup = document.getElementById('moduleEditPopup');
const moduleEditPopupTitle = document.getElementById('moduleEditPopupTitle');
const moduleNaamInput = document.getElementById('moduleNaamInput');
const moduleSleutelInput = document.getElementById('moduleSleutelInput');
const moduleBeschrijvingInput = document.getElementById('moduleBeschrijvingInput');
const moduleStandaardAan = document.getElementById('moduleStandaardAan');
const saveModuleBtn = document.getElementById('saveModuleBtn');
const closeModuleEditPopup = document.getElementById('closeModuleEditPopup');

// ===== STATE =====
let alleGebruikers = [];
let alleModules = [];
let huidigeGebruikerId = null;
let currentModuleId = null;
let isInitialized = false;

// ===== TABS =====
function initTabs() {
  const tabs = document.querySelectorAll('.module-tabs .tab-btn');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.module-tab').forEach(p => p.classList.remove('active'));
      
      const tabName = this.dataset.tab;
      const paneId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
      const pane = document.getElementById(paneId);
      if (pane) {
        pane.classList.add('active');
      }
    });
  });
}

// ============================================================
// HELPER: NAVIGATIE CACHE LEEGMAKEN
// ============================================================
async function refreshNavigatie() {
  try {
    console.log('🔄 Start navigatie refresh...');
    
    try {
      const { default: navigation } = await import('./core/navigation.js');
      
      if (navigation && navigation.resetModuleCache) {
        navigation.resetModuleCache();
        console.log('✅ Navigation cache gereset');
      }
      
      if (navigation && navigation.filterNavigatieModules) {
        await navigation.filterNavigatieModules();
        console.log('✅ Navigatie herladen via filterNavigatieModules');
      }
      
      if (navigation && navigation.laadNavigatie) {
        setTimeout(async () => {
          await navigation.laadNavigatie();
          console.log('✅ Navigatie volledig herladen via laadNavigatie');
        }, 300);
      }
    } catch (navError) {
      console.warn('⚠️ Navigation module import error:', navError);
    }
    
  } catch (err) {
    console.warn('⚠️ Fout bij refreshen navigatie:', err);
  }
}

// ============================================================
// SYNC STANDAARD WAARDEN NAAR ALLE GEBRUIKERS
// ============================================================
async function syncModuleDefaults() {
  if (!confirm('⚠️ Weet je zeker dat je de standaard waarden wilt synchroniseren?\n\nDit zal alle gebruikers zonder expliciete rechten de nieuwe standaard waarden geven.')) {
    return;
  }

  try {
    showToast('🔄 Bezig met synchroniseren...', 'info');
    
    // 1. Haal alle standaard waarden op
    const { data: modules, error: modError } = await supabase
      .from('modules')
      .select('module_sleutel, standaard_aan');
    
    if (modError) throw modError;
    
    // 2. Haal alle gebruikers op
    const { data: gebruikers, error: userError } = await supabase
      .from('gebruikers_rollen')
      .select('user_id')
      .eq('status', 'goedgekeurd');
    
    if (userError) throw userError;
    
    let totalAdded = 0;
    
    // 3. Voor elke gebruiker en elke module, check of er rechten zijn
    for (const gebruiker of gebruikers) {
      // Haal bestaande rechten op voor deze gebruiker
      const { data: bestaandeRechten, error: rechtError } = await supabase
        .from('gebruikers_module_rechten')
        .select('module_sleutel')
        .eq('user_id', gebruiker.user_id);
      
      if (rechtError) throw rechtError;
      
      const bestaandeSleutels = bestaandeRechten.map(r => r.module_sleutel);
      
      // Voor elke module, voeg rechten toe als ze niet bestaan
      for (const module of modules) {
        if (!bestaandeSleutels.includes(module.module_sleutel)) {
          // Geen expliciete rechten, voeg standaard waarde toe
          const { error: insertError } = await supabase
            .from('gebruikers_module_rechten')
            .insert({
              user_id: gebruiker.user_id,
              module_sleutel: module.module_sleutel,
              actief: module.standaard_aan
            });
          
          if (insertError) {
            console.warn(`⚠️ Kon rechten niet toevoegen voor ${gebruiker.user_id} - ${module.module_sleutel}:`, insertError);
          } else {
            totalAdded++;
          }
        }
      }
    }
    
    showToast(`✅ Synchronisatie voltooid! ${totalAdded} rechten toegevoegd.`, 'success');
    
    // Herlaad de modules lijst
    await laadAlleModules();
    
    // Herlaad de navigatie
    await refreshNavigatie();
    
  } catch (err) {
    console.error('Fout bij synchroniseren:', err);
    showToast('❌ Fout bij synchroniseren: ' + err.message, 'error');
  }
}

// ============================================================
// TAB 1: PER GEBRUIKER
// ============================================================

async function laadGebruikersVoorModules() {
  if (!gebruikersModuleLijst) return;
  gebruikersModuleLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    const { data, error } = await supabase
      .from('gebruikers_rollen')
      .select('*')
      .order('gebruikersnaam');

    if (error) throw error;
    alleGebruikers = data || [];

    if (alleGebruikers.length === 0) {
      gebruikersModuleLijst.innerHTML = '<p>Geen gebruikers gevonden.</p>';
      return;
    }

    let html = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left;">Gebruikersnaam</th>
              <th style="padding: 12px; text-align: left;">Rol</th>
              <th style="padding: 12px; text-align: left;">Status</th>
              <th style="padding: 12px; text-align: left;">Acties</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const gebruiker of alleGebruikers) {
      const statusDisplay = gebruiker.status === 'goedgekeurd' ? '✅ Goedgekeurd' : 
                           (gebruiker.status === 'wachtend' ? '⏳ Wachtend' : '❌ Geweigerd');
      
      html += `
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 12px;"><strong>${escapeHtml(gebruiker.gebruikersnaam || '-')}</strong></td>
          <td style="padding: 12px;">${gebruiker.rol === 'admin' ? '👑 Admin' : '👤 Gebruiker'}</td>
          <td style="padding: 12px;">${statusDisplay}</td>
          <td style="padding: 12px;">
            <button class="btn btn-secondary module-rechten-btn" data-userid="${gebruiker.user_id}" data-gebruikersnaam="${escapeHtml(gebruiker.gebruikersnaam || 'Onbekend')}">
              ⚙️ Module rechten
            </button>
          </td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    gebruikersModuleLijst.innerHTML = html;

    document.querySelectorAll('.module-rechten-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.dataset.userid;
        const gebruikersnaam = btn.dataset.gebruikersnaam;
        openModulePopup(userId, gebruikersnaam);
      });
    });

  } catch (err) {
    console.error('Fout bij laden gebruikers:', err);
    gebruikersModuleLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

async function openModulePopup(userId, gebruikersnaam) {
  try {
    huidigeGebruikerId = userId;
    modulePopupTitle.textContent = 'Module rechten bewerken';
    modulePopupUser.textContent = gebruikersnaam;
    moduleCheckboxes.innerHTML = '<p>Laden...</p>';
    modulePopup.style.display = 'flex';

    const { data: modules, error: modError } = await supabase
      .from('modules')
      .select('*')
      .order('module_naam');

    if (modError) throw modError;
    alleModules = modules || [];

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
    moduleCheckboxes.innerHTML = html;

  } catch (err) {
    console.error('Fout bij openen module popup:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

async function saveModuleRights() {
  if (!huidigeGebruikerId) {
    showToast('❌ Geen gebruiker geselecteerd', 'error');
    return;
  }

  try {
    const checkboxes = document.querySelectorAll('.module-recht-checkbox');
    const updates = [];

    for (const checkbox of checkboxes) {
      const moduleSleutel = checkbox.dataset.module;
      const actief = checkbox.checked;
      updates.push({ moduleSleutel, actief });
    }

    for (const update of updates) {
      const { error } = await supabase
        .from('gebruikers_module_rechten')
        .upsert({
          user_id: huidigeGebruikerId,
          module_sleutel: update.moduleSleutel,
          actief: update.actief
        }, {
          onConflict: 'user_id, module_sleutel'
        });

      if (error) throw error;
    }

    const gebruikersnaam = modulePopupUser.textContent || 'Onbekend';
    await logActie('module rechten bijgewerkt', 'modules', huidigeGebruikerId, gebruikersnaam, { updates });

    showToast('✅ Module rechten opgeslagen!', 'success');
    modulePopup.style.display = 'none';
    
    await laadGebruikersVoorModules();
    await refreshNavigatie();

  } catch (err) {
    console.error('Fout bij opslaan module rechten:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ============================================================
// TAB 2: ALLE MODULES
// ============================================================

async function laadAlleModules() {
  console.log('📦 laadAlleModules aangeroepen...');
  if (!modulesLijst) return;
  modulesLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .order('module_naam');

    if (error) throw error;
    alleModules = data || [];
    console.log('📊 Aantal modules geladen:', alleModules.length);

    if (alleModules.length === 0) {
      modulesLijst.innerHTML = '<p>Geen modules gevonden. Klik op "+ Nieuwe module" om er een toe te voegen.</p>';
      return;
    }

    let html = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left;">Module naam</th>
              <th style="padding: 12px; text-align: left;">Sleutel</th>
              <th style="padding: 12px; text-align: left;">Beschrijving</th>
              <th style="padding: 12px; text-align: left;">Standaard aan</th>
              <th style="padding: 12px; text-align: left;">Acties</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const module of alleModules) {
      const standaardDisplay = module.standaard_aan ? '✅ Ja' : '❌ Nee';
      
      html += `
        <tr style="border-bottom: 1px solid #e9ecef;" data-moduleid="${module.id}">
          <td style="padding: 12px;"><strong>${escapeHtml(module.module_naam)}</strong></td>
          <td style="padding: 12px;"><code>${escapeHtml(module.module_sleutel)}</code></td>
          <td style="padding: 12px;">${escapeHtml(module.beschrijving || '-')}</td>
          <td style="padding: 12px;"><span class="standaard-status ${module.standaard_aan ? 'status-actief' : 'status-inactief'}">${standaardDisplay}</span></td>
          <td style="padding: 12px;" class="admin-buttons">
            <button class="btn btn-secondary edit-module-btn" data-id="${module.id}">✏️ Bewerken</button>
            <button class="btn btn-danger delete-module-btn" data-id="${module.id}">🗑️ Verwijderen</button>
          </td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    modulesLijst.innerHTML = html;

    document.querySelectorAll('.edit-module-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkModule(btn.dataset.id));
    });

    document.querySelectorAll('.delete-module-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderModule(btn.dataset.id));
    });

  } catch (err) {
    console.error('Fout bij laden modules:', err);
    modulesLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

function resetModulePopup() {
  setValue('moduleNaamInput', '');
  setValue('moduleSleutelInput', '');
  setValue('moduleBeschrijvingInput', '');
  setValue('moduleStandaardAan', 'true');
}

async function bewerkModule(id) {
  try {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentModuleId = id;
    moduleEditPopupTitle.textContent = 'Module bewerken';
    setValue('moduleNaamInput', data.module_naam);
    setValue('moduleSleutelInput', data.module_sleutel);
    setValue('moduleBeschrijvingInput', data.beschrijving || '');
    setValue('moduleStandaardAan', data.standaard_aan ? 'true' : 'false');

    moduleEditPopup.style.display = 'flex';
  } catch (err) {
    console.error('Fout bij bewerken module:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

async function saveModule() {
  const naam = getValue('moduleNaamInput');
  const sleutel = getValue('moduleSleutelInput');
  const beschrijving = getValue('moduleBeschrijvingInput') || null;
  const standaardAan = getValue('moduleStandaardAan') === 'true';

  if (!naam || !sleutel) {
    showToast('Vul module naam en sleutel in', 'error');
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(sleutel)) {
    showToast('Sleutel mag alleen letters, cijfers en underscores bevatten', 'error');
    return;
  }

  const moduleData = {
    module_naam: naam,
    module_sleutel: sleutel,
    beschrijving: beschrijving,
    standaard_aan: standaardAan
  };

  try {
    let result;
    const isBewerken = !!currentModuleId;

    if (isBewerken) {
      result = await supabase
        .from('modules')
        .update(moduleData)
        .eq('id', currentModuleId);
    } else {
      result = await supabase
        .from('modules')
        .insert([moduleData]);
    }

    if (result.error) throw result.error;

    const actie = isBewerken ? 'bijgewerkt' : 'toegevoegd';
    const entityId = isBewerken ? currentModuleId : result.data?.[0]?.id;
    await logActie(actie, 'modules', entityId, naam);

    showToast('✅ Module opgeslagen!', 'success');
    moduleEditPopup.style.display = 'none';
    currentModuleId = null;
    resetModulePopup();
    
    // 🔥 DIRECT DE TABEL VERNIEUWEN (zonder setTimeout)
    await laadAlleModules();
    await laadGebruikersVoorModules();
    await refreshNavigatie();

  } catch (err) {
    console.error('Fout bij opslaan module:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

async function verwijderModule(id) {
  if (!confirm('Weet je zeker dat je deze module wilt verwijderen?')) return;

  const moduleSleutel = alleModules.find(m => m.id === id)?.module_sleutel;
  const { count, error: countError } = await supabase
    .from('gebruikers_module_rechten')
    .select('*', { count: 'exact', head: true })
    .eq('module_sleutel', moduleSleutel);

  if (countError) {
    console.error('Fout bij controleren module gebruik:', countError);
  }

  if (count > 0) {
    if (!confirm(`⚠️ Deze module wordt nog gebruikt door ${count} gebruiker(s).\n\nWeet je zeker dat je deze module wilt verwijderen?`)) {
      return;
    }
  }

  try {
    if (moduleSleutel) {
      await supabase
        .from('gebruikers_module_rechten')
        .delete()
        .eq('module_sleutel', moduleSleutel);
    }

    const { error } = await supabase
      .from('modules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logActie('verwijderd', 'modules', id);
    showToast('✅ Module verwijderd!', 'success');
    
    await laadAlleModules();
    await laadGebruikersVoorModules();
    await refreshNavigatie();

  } catch (err) {
    console.error('Fout bij verwijderen module:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ============================================================
// HULPFUNCTIES
// ============================================================

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// ============================================================
// ZOEKFUNCTIES
// ============================================================

function setupSearchListeners() {
  if (searchModuleUserInput) {
    searchModuleUserInput.addEventListener('input', function() {
      const term = this.value.toLowerCase();
      const rows = document.querySelectorAll('#gebruikersModuleLijst table tbody tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  if (clearModuleUserSearchBtn) {
    clearModuleUserSearchBtn.addEventListener('click', () => {
      searchModuleUserInput.value = '';
      const rows = document.querySelectorAll('#gebruikersModuleLijst table tbody tr');
      rows.forEach(row => {
        row.style.display = '';
      });
      searchModuleUserInput.focus();
    });
  }

  if (searchModulesInput) {
    searchModulesInput.addEventListener('input', function() {
      const term = this.value.toLowerCase();
      const rows = document.querySelectorAll('#modulesLijst table tbody tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  if (clearModulesSearchBtn) {
    clearModulesSearchBtn.addEventListener('click', () => {
      searchModulesInput.value = '';
      const rows = document.querySelectorAll('#modulesLijst table tbody tr');
      rows.forEach(row => {
        row.style.display = '';
      });
      searchModulesInput.focus();
    });
  }
}

// ============================================================
// INITIALISATIE
// ============================================================

async function initModules() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('🔄 Modules initialisatie gestart...');

  const isAdmin = await requireAdmin('dashboard.html');
  if (!isAdmin) {
    console.warn('⚠️ Geen admin rechten, redirect...');
    return;
  }

  console.log('✅ Admin rechten bevestigd');

  initTabs();
  setupSearchListeners();

  await laadGebruikersVoorModules();
  await laadAlleModules();

  const firstTab = document.querySelector('.module-tabs .tab-btn');
  if (firstTab) {
    firstTab.click();
  }

  // ===== EVENT LISTENERS =====

  if (saveModuleRightsBtn) {
    saveModuleRightsBtn.addEventListener('click', saveModuleRights);
  }

  if (closeModulePopup) {
    closeModulePopup.addEventListener('click', () => {
      modulePopup.style.display = 'none';
    });
  }

  if (addModuleBtn) {
    addModuleBtn.addEventListener('click', () => {
      currentModuleId = null;
      moduleEditPopupTitle.textContent = 'Nieuwe module';
      resetModulePopup();
      moduleEditPopup.style.display = 'flex';
    });
  }

  if (saveModuleBtn) {
    saveModuleBtn.addEventListener('click', saveModule);
  }

  if (closeModuleEditPopup) {
    closeModuleEditPopup.addEventListener('click', () => {
      moduleEditPopup.style.display = 'none';
      currentModuleId = null;
      resetModulePopup();
    });
  }

  // 🔥 Sync standaard waarden knop
  if (syncModuleDefaultsBtn) {
    syncModuleDefaultsBtn.addEventListener('click', syncModuleDefaults);
  }

  // 🔥 Refresh modules knop
  if (refreshModulesBtn) {
    refreshModulesBtn.addEventListener('click', async () => {
      showToast('🔄 Bezig met verversen...', 'info');
      await laadAlleModules();
      showToast('✅ Modules verversd!', 'success');
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === modulePopup) {
      modulePopup.style.display = 'none';
    }
    if (e.target === moduleEditPopup) {
      moduleEditPopup.style.display = 'none';
      currentModuleId = null;
      resetModulePopup();
    }
  });

  console.log('✅ Modules geïnitialiseerd!');
}

// ===== START =====
document.addEventListener('DOMContentLoaded', initModules);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('🔄 DOM al geladen, start modules direct...');
  initModules();
}

console.log('✅ modules.js geladen!');