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
const modulePopup = document.getElementById('modulePopup');
const modulePopupTitle = document.getElementById('modulePopupTitle');
const modulePopupUser = document.getElementById('modulePopupUser');
const moduleCheckboxes = document.getElementById('moduleCheckboxes');
const saveModuleRightsBtn = document.getElementById('saveModuleRightsBtn');
const closeModulePopup = document.getElementById('closeModulePopup');

// ===== STATE =====
let alleGebruikers = [];
let alleModules = [];
let huidigeGebruikerId = null;
let isInitialized = false;

// ===== GEBRUIKERS LADEN =====
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

// ===== MODULE POPUP OPENEN =====
async function openModulePopup(userId, gebruikersnaam) {
  try {
    huidigeGebruikerId = userId;
    modulePopupTitle.textContent = 'Module rechten bewerken';
    modulePopupUser.textContent = gebruikersnaam;
    moduleCheckboxes.innerHTML = '<p>Laden...</p>';
    modulePopup.style.display = 'flex';

    // Haal alle modules op
    const { data: modules, error: modError } = await supabase
      .from('modules')
      .select('*')
      .order('module_naam');

    if (modError) throw modError;
    alleModules = modules || [];

    // Haal bestaande rechten op voor deze gebruiker
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

// ===== MODULE RECHTEN OPSLAAN =====
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

    // Sla alle rechten op
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

    // Log de actie
    const gebruikersnaam = modulePopupUser.textContent || 'Onbekend';
    await logActie('module rechten bijgewerkt', 'modules', huidigeGebruikerId, gebruikersnaam, { updates });

    showToast('✅ Module rechten opgeslagen!', 'success');
    modulePopup.style.display = 'none';
    laadGebruikersVoorModules();

  } catch (err) {
    console.error('Fout bij opslaan module rechten:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== INITIALISATIE =====
async function initModules() {
  if (isInitialized) {
    console.log('⚠️ Modules al geïnitialiseerd, overslaan');
    return;
  }
  isInitialized = true;

  console.log('🔄 Modules initialisatie gestart...');

  const isAdmin = await requireAdmin('dashboard.html');
  if (!isAdmin) {
    console.warn('⚠️ Geen admin rechten, redirect...');
    return;
  }

  console.log('✅ Admin rechten bevestigd');

  await laadGebruikersVoorModules();

  // ===== EVENT LISTENERS =====

  if (saveModuleRightsBtn) {
    saveModuleRightsBtn.addEventListener('click', saveModuleRights);
  }

  if (closeModulePopup) {
    closeModulePopup.addEventListener('click', () => {
      modulePopup.style.display = 'none';
    });
  }

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

  window.addEventListener('click', (e) => {
    if (e.target === modulePopup) {
      modulePopup.style.display = 'none';
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