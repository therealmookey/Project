// ============================================================
// LOGS - Logboek pagina
// ============================================================
console.log('📋 logs.js geladen');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase } from './core/supabase.js';

// ===== STATE =====
let huidigePagina = 1;
const logsPerPagina = 50;
let totaalLogs = 0;
let huidigeFilters = {
  vanaf: null,
  tot: null,
  gebruiker: 'alles',
  module: 'alles',
  actie: 'alles'
};
let alleGebruikers = [];

// ===== DOM ELEMENTEN =====
const logLijst = document.getElementById('logLijst');
const filterVanaf = document.getElementById('logFilterVanaf');
const filterTot = document.getElementById('logFilterTot');
const filterGebruiker = document.getElementById('logFilterGebruiker');
const filterModule = document.getElementById('logFilterModule');
const filterActie = document.getElementById('logFilterActie');
const filterBtn = document.getElementById('logFilterBtn');
const resetBtn = document.getElementById('logResetBtn');
const exportBtn = document.getElementById('logExportBtn');
const refreshBtn = document.getElementById('logRefreshBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const paginationContainer = document.getElementById('paginationContainer');

// ===== TOEGANGSCONTROLE =====
async function checkToegang(userId) {
  try {
    const { data: rolData, error: rolError } = await supabase
      .from('gebruikers_rollen')
      .select('rol')
      .eq('user_id', userId)
      .single();
    if (rolError) throw rolError;
    
    if (rolData?.rol === 'admin') {
      return true;
    }

    const { data: moduleRecht, error: moduleError } = await supabase
      .from('gebruikers_module_rechten')
      .select('actief')
      .eq('user_id', userId)
      .eq('module_sleutel', 'logs')
      .single();

    return moduleRecht?.actief === true;
  } catch (err) {
    console.error('Fout bij toegangscontrole:', err);
    return false;
  }
}

// ===== GEBRUIKERS LADEN VOOR FILTER =====
async function laadGebruikersVoorFilter() {
  try {
    const { data, error } = await supabase
      .from('gebruikers_rollen')
      .select('user_id, gebruikersnaam')
      .order('gebruikersnaam');
    if (error) throw error;
    alleGebruikers = data || [];
    filterGebruiker.innerHTML = '<option value="alles">Alle gebruikers</option>';
    alleGebruikers.forEach(user => {
      const option = document.createElement('option');
      option.value = user.user_id;
      option.textContent = user.gebruikersnaam || user.user_id.substring(0, 8);
      filterGebruiker.appendChild(option);
    });
  } catch (err) {
    console.error('Fout bij laden gebruikers:', err);
  }
}

// ===== LOGS LADEN (zonder join) =====
async function laadLogs() {
  if (!logLijst) return;
  logLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    // 🔥 VERANDERD: Geen join meer
    let query = supabase
      .from('activiteitenlog')
      .select('*', { count: 'exact' });

    if (huidigeFilters.vanaf) {
      query = query.gte('created_at', huidigeFilters.vanaf + 'T00:00:00');
    }
    if (huidigeFilters.tot) {
      query = query.lte('created_at', huidigeFilters.tot + 'T23:59:59');
    }
    if (huidigeFilters.gebruiker && huidigeFilters.gebruiker !== 'alles') {
      query = query.eq('user_id', huidigeFilters.gebruiker);
    }
    if (huidigeFilters.module && huidigeFilters.module !== 'alles') {
      query = query.eq('module', huidigeFilters.module);
    }
    if (huidigeFilters.actie && huidigeFilters.actie !== 'alles') {
      query = query.eq('actie', huidigeFilters.actie);
    }

    const from = (huidigePagina - 1) * logsPerPagina;
    const to = from + logsPerPagina - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;

    totaalLogs = count || 0;
    const logs = data || [];

    // 🔥 Gebruikersnamen apart ophalen
    if (logs.length > 0) {
      const userIds = [...new Set(logs.map(log => log.user_id).filter(id => id))];
      let gebruikersMap = {};
      if (userIds.length > 0) {
        const { data: gebruikers, error: gError } = await supabase
          .from('gebruikers_rollen')
          .select('user_id, gebruikersnaam')
          .in('user_id', userIds);
        
        if (!gError && gebruikers) {
          gebruikers.forEach(g => {
            gebruikersMap[g.user_id] = g.gebruikersnaam;
          });
        }
      }
      logs.forEach(log => {
        log.user = { gebruikersnaam: gebruikersMap[log.user_id] || log.user_id?.substring(0, 8) || 'Onbekend' };
      });
    }

    if (logs.length === 0) {
      logLijst.innerHTML = '<p>Geen logs gevonden met de huidige filters.</p>';
      paginationContainer.style.display = 'none';
      return;
    }

    toonLogs(logs);
    toonPaginering();

  } catch (err) {
    console.error('Fout bij laden logs:', err);
    logLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== LOGS TONEN =====
function toonLogs(logs) {
  const actieIcons = {
    'toegevoegd': '➕',
    'bijgewerkt': '✏️',
    'verwijderd': '🗑️',
    'goedgekeurd': '✅',
    'geweigerd': '❌',
    'ingelogd': '🔐',
    'uitgelogd': '🚪',
    'geëxporteerd': '📊',
    'voorraad aangepast': '📦'
  };

  const moduleIcons = {
    'adressen': '📍',
    'planning': '📅',
    'registraties': '📋',
    'stock': '📦',
    'gebruikers': '👤',
    'admin': '👑',
    'auth': '🔐',
    'analytics': '📊',
    'logs': '📋'
  };

  let html = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 12px; text-align: left;">Tijdstip</th>
            <th style="padding: 12px; text-align: left;">Gebruiker</th>
            <th style="padding: 12px; text-align: left;">Module</th>
            <th style="padding: 12px; text-align: left;">Actie</th>
            <th style="padding: 12px; text-align: left;">Entity</th>
            <th style="padding: 12px; text-align: left;">Details</th>
          </tr>
        </thead>
        <tbody>
  `;

  logs.forEach(log => {
    const datum = new Date(log.created_at).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const actieIcon = actieIcons[log.actie] || '📌';
    const moduleIcon = moduleIcons[log.module] || '📂';
    const gebruiker = log.user?.gebruikersnaam || 'Onbekend';

    let detailsHtml = '-';
    if (log.details) {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        detailsHtml = Object.entries(details)
          .filter(([key]) => !['user_id', 'created_at', 'id'].includes(key))
          .map(([key, value]) => {
            if (typeof value === 'object') return `${key}: ${JSON.stringify(value).substring(0, 30)}...`;
            return `${key}: ${value}`;
          })
          .join(', ');
        if (detailsHtml.length > 80) detailsHtml = detailsHtml.substring(0, 80) + '...';
      } catch(e) {
        detailsHtml = String(log.details).substring(0, 80);
      }
    }

    const entityDisplay = log.entity_naam || log.entity_id || '-';

    html += `
      <tr style="border-bottom: 1px solid #e9ecef;">
        <td style="padding: 10px; font-size: 0.8rem; white-space: nowrap;">${datum}</td>
        <td style="padding: 10px;"><strong>${escapeHtml(gebruiker)}</strong></td>
        <td style="padding: 10px;">${moduleIcon} ${escapeHtml(log.module)}</td>
        <td style="padding: 10px;">${actieIcon} ${escapeHtml(log.actie)}</td>
        <td style="padding: 10px; font-size: 0.85rem;">${escapeHtml(entityDisplay)}</td>
        <td style="padding: 10px; font-size: 0.8rem; color: #6c757d;">${escapeHtml(detailsHtml)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
    <div style="margin-top: 1rem; font-size: 0.85rem; color: #6c757d;">
      <span>📊 ${totaalLogs} logs gevonden</span>
    </div>
  `;

  logLijst.innerHTML = html;
}

// ===== PAGINERING =====
function toonPaginering() {
  const totaalPaginas = Math.ceil(totaalLogs / logsPerPagina);
  if (totaalPaginas <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  paginationContainer.style.display = 'flex';
  pageInfo.textContent = `Pagina ${huidigePagina} van ${totaalPaginas}`;
  prevPageBtn.disabled = huidigePagina === 1;
  nextPageBtn.disabled = huidigePagina === totaalPaginas;
}

// ===== FILTERS =====
function pasFiltersToe() {
  huidigeFilters.vanaf = filterVanaf.value || null;
  huidigeFilters.tot = filterTot.value || null;
  huidigeFilters.gebruiker = filterGebruiker.value || 'alles';
  huidigeFilters.module = filterModule.value || 'alles';
  huidigeFilters.actie = filterActie.value || 'alles';
  huidigePagina = 1;
  laadLogs();
}

function resetFilters() {
  filterVanaf.value = '';
  filterTot.value = '';
  filterGebruiker.value = 'alles';
  filterModule.value = 'alles';
  filterActie.value = 'alles';
  huidigeFilters = {
    vanaf: null,
    tot: null,
    gebruiker: 'alles',
    module: 'alles',
    actie: 'alles'
  };
  huidigePagina = 1;
  laadLogs();
  showToast('↺ Filters gereset', 'info');
}

// ===== EXPORT EXCEL =====
async function exportLogs() {
  try {
    showToast('📊 Excel wordt voorbereid...', 'info');
    
    let query = supabase
      .from('activiteitenlog')
      .select('*');

    if (huidigeFilters.vanaf) {
      query = query.gte('created_at', huidigeFilters.vanaf + 'T00:00:00');
    }
    if (huidigeFilters.tot) {
      query = query.lte('created_at', huidigeFilters.tot + 'T23:59:59');
    }
    if (huidigeFilters.gebruiker && huidigeFilters.gebruiker !== 'alles') {
      query = query.eq('user_id', huidigeFilters.gebruiker);
    }
    if (huidigeFilters.module && huidigeFilters.module !== 'alles') {
      query = query.eq('module', huidigeFilters.module);
    }
    if (huidigeFilters.actie && huidigeFilters.actie !== 'alles') {
      query = query.eq('actie', huidigeFilters.actie);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      showToast('⚠️ Geen logs om te exporteren', 'error');
      return;
    }

    // Haal gebruikersnamen op voor de export
    const userIds = [...new Set(data.map(log => log.user_id).filter(id => id))];
    let gebruikersMap = {};
    if (userIds.length > 0) {
      const { data: gebruikers, error: gError } = await supabase
        .from('gebruikers_rollen')
        .select('user_id, gebruikersnaam')
        .in('user_id', userIds);
      
      if (!gError && gebruikers) {
        gebruikers.forEach(g => {
          gebruikersMap[g.user_id] = g.gebruikersnaam;
        });
      }
    }

    const excelData = data.map(log => ({
      'Datum': new Date(log.created_at).toLocaleString('nl-NL'),
      'Gebruiker': gebruikersMap[log.user_id] || log.user_id || 'Onbekend',
      'Module': log.module,
      'Actie': log.actie,
      'Entity': log.entity_naam || log.entity_id || '-',
      'Details': log.details ? JSON.stringify(log.details) : '-'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Logboek');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logboek_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✅ Excel export succesvol!', 'success');
  } catch (err) {
    console.error('Fout bij export:', err);
    showToast('❌ Fout bij export: ' + err.message, 'error');
  }
}

// ===== INITIALISATIE =====
document.addEventListener('DOMContentLoaded', async function() {
  console.log('📄 DOM geladen, logs start...');

  const auth = await requireAuth('index.html');
  if (!auth.isAuthenticated) {
    console.warn('⚠️ Niet ingelogd, redirect...');
    return;
  }

  const heeftToegang = await checkToegang(auth.user.id);
  if (!heeftToegang) {
    showToast('❌ Je hebt geen toegang tot het logboek', 'error');
    window.location.href = 'dashboard.html';
    return;
  }

  await laadGebruikersVoorFilter();
  await laadLogs();

  filterBtn.addEventListener('click', pasFiltersToe);
  resetBtn.addEventListener('click', resetFilters);
  exportBtn.addEventListener('click', exportLogs);
  refreshBtn.addEventListener('click', laadLogs);
  prevPageBtn.addEventListener('click', () => {
    if (huidigePagina > 1) {
      huidigePagina--;
      laadLogs();
    }
  });
  nextPageBtn.addEventListener('click', () => {
    const totaalPaginas = Math.ceil(totaalLogs / logsPerPagina);
    if (huidigePagina < totaalPaginas) {
      huidigePagina++;
      laadLogs();
    }
  });

  document.querySelectorAll('.filter-item input, .filter-item select').forEach(el => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        pasFiltersToe();
      }
    });
  });

  console.log('✅ Logs geladen!');
});

console.log('✅ logs.js geladen!');