// ============================================================
// PLANNING - Planning pagina (Volledig hersteld)
// ============================================================
console.log('🚀 planning.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase, logActie } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let allePlanningen = [];
let alleAdressen = [];
let currentPlanningId = null;
let sortableInstances = [];
let isOptimizing = false;

// ===== DOM ELEMENTEN =====
const planningLijst = document.getElementById('planningLijst');
const newPlanningBtn = document.getElementById('newPlanningBtn');
const refreshPlanningBtn = document.getElementById('refreshPlanningBtn');
const aiOptimizeBtn = document.getElementById('aiOptimizeBtn');
const planningPopup = document.getElementById('planningPopup');
const planningPopupTitle = document.getElementById('planningPopupTitle');
const typeSelect = document.getElementById('typeSelect');
const adresSelect = document.getElementById('adresSelect');
const planningDatum = document.getElementById('planningDatum');
const opmerkingen = document.getElementById('opmerkingen');
const savePlanningBtn = document.getElementById('savePlanningBtn');
const closePlanningPopup = document.getElementById('closePlanningPopup');
const ophalingVelden = document.getElementById('ophalingVelden');
const plaatsingVelden = document.getElementById('plaatsingVelden');
const aantalTonnen = document.getElementById('aantalTonnen');
const aantalLegeTonnen = document.getElementById('aantalLegeTonnen');

// ===== HULPFUNCTIES =====
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('nl-NL');
}

// ===== ADRESSEN LADEN =====
async function laadAdressenVoorSelect() {
  try {
    const { data, error } = await supabase
      .from('adressen')
      .select('id, instelling_naam, straat, plaats')
      .order('instelling_naam');
    if (error) throw error;
    alleAdressen = data || [];
    adresSelect.innerHTML = '<option value="">Kies een adres...</option>';
    alleAdressen.forEach(a => {
      const option = document.createElement('option');
      option.value = a.id;
      option.textContent = `${a.instelling_naam} (${a.straat}, ${a.plaats})`;
      adresSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Fout bij laden adressen:', err);
  }
}

// ============================================================
// PLANNINGEN LADEN
// ============================================================
async function laadPlanningen() {
  console.log('📋 laadPlanningen aangeroepen...');
  if (!planningLijst) return;
  planningLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    const { data, error } = await supabase
      .from('planningen')
      .select('*, adres:adres_id (id, instelling_naam, straat, plaats, telefoon, extra_info)')
      .order('datum', { ascending: false })
      .order('dag_volgorde', { ascending: true });

    if (error) throw error;
    allePlanningen = data || [];

    if (allePlanningen.length === 0) {
      planningLijst.innerHTML = '<p>Geen planningen gevonden. Klik op "+ Nieuwe planning" om er een toe te voegen.</p>';
      return;
    }

    // Groepeer op datum
    const grouped = {};
    allePlanningen.forEach(p => {
      if (!grouped[p.datum]) {
        grouped[p.datum] = [];
      }
      grouped[p.datum].push(p);
    });

    let html = '';
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    for (const datum of sortedDates) {
      const items = grouped[datum];
      const dagVanWeek = new Date(datum + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long' });
      
      html += `
        <div class="datum-header">
          <div class="datum-header-content">
            <span class="datum-dag">${dagVanWeek}</span>
            <span class="datum-datum">${formatDate(datum)}</span>
            <span class="datum-count">${items.length} ritten</span>
          </div>
          <div class="datum-actions">
            <button class="btn btn-primary btn-small pdf-dag-btn" data-datum="${datum}">📄 PDF</button>
            <button class="btn btn-info btn-small ai-optimize-day-btn" data-datum="${datum}">🤖 Optimaliseer</button>
          </div>
        </div>
        <div class="planning-sortable-container" data-datum="${datum}">
      `;

      items.forEach((planning, index) => {
        const statusClass = planning.status === 'gepland' ? 'status-gepland' : 
                            (planning.status === 'uitgevoerd' ? 'status-uitgevoerd' : 'status-geannuleerd');
        const typeIcon = planning.type === 'ophaling' ? '📦' : '🚚';
        const typeLabel = planning.type === 'ophaling' ? 'Ophaling' : 'Plaatsing';
        const volgorde = planning.dag_volgorde || index + 1;

        // 🔥 Opmerkingen/notities worden nu getoond
        let opmerkingHtml = '';
        if (planning.opmerkingen) {
          opmerkingHtml = `<p class="planning-opmerking">💬 ${escapeHtml(planning.opmerkingen)}</p>`;
        }

        html += `
          <div class="planning-item sortable-item" data-id="${planning.id}" data-volgorde="${volgorde}" data-datum="${datum}">
            <div class="drag-handle" title="Sleep om te herordenen">⠿</div>
            <div class="planning-info">
              <div class="planning-header">
                <span class="stop-number-badge">#${volgorde}</span>
                <h4>${escapeHtml(planning.adres?.instelling_naam || 'Onbekend')}</h4>
                <span class="planning-status ${statusClass}">${planning.status || 'gepland'}</span>
              </div>
              <p>📍 ${escapeHtml(planning.adres?.straat || '')}, ${escapeHtml(planning.adres?.plaats || '')}</p>
              <p>📋 ${typeIcon} ${typeLabel}</p>
              ${planning.type === 'ophaling' && planning.aantal_tonnen ? `<p>📦 ${planning.aantal_tonnen} ton(nen)</p>` : ''}
              ${planning.type === 'plaatsing' && planning.aantal_lege_tonnen ? `<p>📦 ${planning.aantal_lege_tonnen} lege ton(nen)</p>` : ''}
              ${planning.adres?.telefoon ? `<p>📞 ${escapeHtml(planning.adres.telefoon)}</p>` : ''}
              ${planning.adres?.extra_info ? `<p class="planning-extra-info">📝 ${escapeHtml(planning.adres.extra_info)}</p>` : ''}
              ${opmerkingHtml}
            </div>
            <div class="planning-buttons">
              <select class="status-select" data-id="${planning.id}">
                <option value="gepland" ${planning.status === 'gepland' ? 'selected' : ''}>📋 Gepland</option>
                <option value="uitgevoerd" ${planning.status === 'uitgevoerd' ? 'selected' : ''}>✅ Uitgevoerd</option>
                <option value="geannuleerd" ${planning.status === 'geannuleerd' ? 'selected' : ''}>❌ Geannuleerd</option>
              </select>
              <button class="btn btn-secondary edit-planning-btn" data-id="${planning.id}">✏️ Bewerken</button>
              <button class="btn btn-danger delete-planning-btn" data-id="${planning.id}">🗑️ Verwijderen</button>
            </div>
          </div>
        `;
      });

      html += `
        </div>
      `;
    }

    planningLijst.innerHTML = html;

    // Event listeners
    document.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', async function() {
        const id = this.dataset.id;
        const nieuweStatus = this.value;
        await updatePlanningStatus(id, nieuweStatus);
      });
    });

    document.querySelectorAll('.edit-planning-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkPlanning(btn.dataset.id));
    });

    document.querySelectorAll('.delete-planning-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderPlanning(btn.dataset.id));
    });

    document.querySelectorAll('.pdf-dag-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const datum = this.dataset.datum;
        genereerPDFVoorDag(datum);
      });
    });

    document.querySelectorAll('.ai-optimize-day-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const datum = this.dataset.datum;
        optimizeRouteVoorDag(datum);
      });
    });

    // Init sortable
    initSortable();

  } catch (err) {
    console.error('Fout bij laden planningen:', err);
    planningLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== SORTABLE INIT =====
function initSortable() {
  sortableInstances.forEach(instance => {
    if (instance) instance.destroy();
  });
  sortableInstances = [];

  const containers = document.querySelectorAll('.planning-sortable-container');
  
  containers.forEach(container => {
    const sortable = Sortable.create(container, {
      handle: '.drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: function(evt) {
        const datum = container.dataset.datum;
        const items = container.querySelectorAll('.sortable-item');
        const updates = [];
        items.forEach((item, index) => {
          const id = item.dataset.id;
          const nieuweVolgorde = index + 1;
          updates.push({ id, volgorde: nieuweVolgorde });
        });
        updateRouteOrder(updates, datum);
      }
    });

    sortableInstances.push(sortable);
  });
}

// ===== ROUTE VOLGORDE UPDATE =====
async function updateRouteOrder(updates, datum) {
  try {
    for (const update of updates) {
      const { error } = await supabase
        .from('planningen')
        .update({ dag_volgorde: update.volgorde })
        .eq('id', update.id);
      
      if (error) throw error;
    }

    await logActie('route volgorde aangepast', 'planning', null, null, { 
      datum: datum,
      updates: updates 
    });

    showToast('✅ Route volgorde opgeslagen!', 'success');
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij updaten route volgorde:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== STATUS UPDATE =====
async function updatePlanningStatus(id, nieuweStatus) {
  try {
    const { error } = await supabase
      .from('planningen')
      .update({ status: nieuweStatus })
      .eq('id', id);

    if (error) throw error;
    await logActie('status gewijzigd', 'planning', id, null, { nieuweStatus });
    showToast('✅ Status bijgewerkt!', 'success');
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij updaten status:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ============================================================
// PLANNING CRUD
// ============================================================
async function savePlanning() {
  const type = getValue('typeSelect');
  const adresId = getValue('adresSelect');
  const datum = getValue('planningDatum');
  const opmerking = getValue('opmerkingen');

  if (!type || !adresId || !datum) {
    showToast('Vul alle verplichte velden in', 'error');
    return;
  }

  const planningData = {
    type: type,
    adres_id: parseInt(adresId),
    datum: datum,
    opmerkingen: opmerking || null,
    status: 'gepland'
  };

  if (type === 'ophaling') {
    planningData.aantal_tonnen = parseInt(getValue('aantalTonnen')) || 1;
  } else if (type === 'plaatsing') {
    planningData.aantal_lege_tonnen = parseInt(getValue('aantalLegeTonnen')) || 1;
  }

  try {
    let result;
    const isBewerken = !!currentPlanningId;

    if (isBewerken) {
      result = await supabase
        .from('planningen')
        .update(planningData)
        .eq('id', currentPlanningId);
    } else {
      result = await supabase
        .from('planningen')
        .insert([planningData]);
    }

    if (result.error) throw result.error;

    const actie = isBewerken ? 'bijgewerkt' : 'toegevoegd';
    const entityId = isBewerken ? currentPlanningId : result.data?.[0]?.id;
    const adresNaam = alleAdressen.find(a => a.id === parseInt(adresId))?.instelling_naam || 'Onbekend';
    await logActie(actie, 'planning', entityId, `Planning voor ${adresNaam} op ${datum}`);

    showToast('✅ Planning opgeslagen!', 'success');
    planningPopup.style.display = 'none';
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij opslaan:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

async function bewerkPlanning(id) {
  try {
    const { data, error } = await supabase
      .from('planningen')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentPlanningId = id;
    planningPopupTitle.textContent = 'Planning bewerken';
    setValue('typeSelect', data.type);
    setValue('adresSelect', data.adres_id);
    setValue('planningDatum', data.datum);
    setValue('opmerkingen', data.opmerkingen || '');

    if (data.type === 'ophaling') {
      setValue('aantalTonnen', data.aantal_tonnen || 1);
      ophalingVelden.style.display = 'block';
      plaatsingVelden.style.display = 'none';
    } else {
      setValue('aantalLegeTonnen', data.aantal_lege_tonnen || 1);
      ophalingVelden.style.display = 'none';
      plaatsingVelden.style.display = 'block';
    }

    planningPopup.style.display = 'flex';
  } catch (err) {
    console.error('Fout bij bewerken:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

async function verwijderPlanning(id) {
  if (!confirm('Weet je zeker dat je deze planning wilt verwijderen?')) return;

  try {
    const { error } = await supabase
      .from('planningen')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logActie('verwijderd', 'planning', id);
    showToast('✅ Planning verwijderd!', 'success');
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij verwijderen:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ============================================================
// PLANNINGEN LADEN (Met contactpersoon)
// ============================================================
async function laadPlanningen() {
  console.log('📋 laadPlanningen aangeroepen...');
  if (!planningLijst) return;
  planningLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    // 🔥 contactpersoon_naam toegevoegd
    const { data, error } = await supabase
      .from('planningen')
      .select('*, adres:adres_id (id, instelling_naam, straat, plaats, telefoon, extra_info, contactpersoon_naam)')
      .order('datum', { ascending: false })
      .order('dag_volgorde', { ascending: true });

    if (error) throw error;
    allePlanningen = data || [];

    if (allePlanningen.length === 0) {
      planningLijst.innerHTML = '<p>Geen planningen gevonden. Klik op "+ Nieuwe planning" om er een toe te voegen.</p>';
      return;
    }

    // Groepeer op datum
    const grouped = {};
    allePlanningen.forEach(p => {
      if (!grouped[p.datum]) {
        grouped[p.datum] = [];
      }
      grouped[p.datum].push(p);
    });

    let html = '';
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    for (const datum of sortedDates) {
      const items = grouped[datum];
      const dagVanWeek = new Date(datum + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long' });
      
      html += `
        <div class="datum-header">
          <div class="datum-header-content">
            <span class="datum-dag">${dagVanWeek}</span>
            <span class="datum-datum">${formatDate(datum)}</span>
            <span class="datum-count">${items.length} ritten</span>
          </div>
          <div class="datum-actions">
            <button class="btn btn-primary btn-small pdf-dag-btn" data-datum="${datum}">📄 PDF</button>
            <button class="btn btn-info btn-small ai-optimize-day-btn" data-datum="${datum}">🤖 Optimaliseer</button>
          </div>
        </div>
        <div class="planning-sortable-container" data-datum="${datum}">
      `;

      items.forEach((planning, index) => {
        const statusClass = planning.status === 'gepland' ? 'status-gepland' : 
                            (planning.status === 'uitgevoerd' ? 'status-uitgevoerd' : 'status-geannuleerd');
        const typeIcon = planning.type === 'ophaling' ? '📦' : '🚚';
        const typeLabel = planning.type === 'ophaling' ? 'Ophaling' : 'Plaatsing';
        const volgorde = planning.dag_volgorde || index + 1;

        // 🔥 Contactpersoon weergeven in de planning lijst
        let contactHtml = '';
        if (planning.adres?.contactpersoon_naam) {
          contactHtml = `<p>👤 ${escapeHtml(planning.adres.contactpersoon_naam)}</p>`;
        }

        let opmerkingHtml = '';
        if (planning.opmerkingen) {
          opmerkingHtml = `<p class="planning-opmerking">💬 ${escapeHtml(planning.opmerkingen)}</p>`;
        }

        html += `
          <div class="planning-item sortable-item" data-id="${planning.id}" data-volgorde="${volgorde}" data-datum="${datum}">
            <div class="drag-handle" title="Sleep om te herordenen">⠿</div>
            <div class="planning-info">
              <div class="planning-header">
                <span class="stop-number-badge">#${volgorde}</span>
                <h4>${escapeHtml(planning.adres?.instelling_naam || 'Onbekend')}</h4>
                <span class="planning-status ${statusClass}">${planning.status || 'gepland'}</span>
              </div>
              <p>📍 ${escapeHtml(planning.adres?.straat || '')}, ${escapeHtml(planning.adres?.plaats || '')}</p>
              <p>📋 ${typeIcon} ${typeLabel}</p>
              ${planning.type === 'ophaling' && planning.aantal_tonnen ? `<p>📦 ${planning.aantal_tonnen} ton(nen)</p>` : ''}
              ${planning.type === 'plaatsing' && planning.aantal_lege_tonnen ? `<p>📦 ${planning.aantal_lege_tonnen} lege ton(nen)</p>` : ''}
              ${planning.adres?.telefoon ? `<p>📞 ${escapeHtml(planning.adres.telefoon)}</p>` : ''}
              ${contactHtml}
              ${planning.adres?.extra_info ? `<p class="planning-extra-info">📝 ${escapeHtml(planning.adres.extra_info)}</p>` : ''}
              ${opmerkingHtml}
            </div>
            <div class="planning-buttons">
              <select class="status-select" data-id="${planning.id}">
                <option value="gepland" ${planning.status === 'gepland' ? 'selected' : ''}>📋 Gepland</option>
                <option value="uitgevoerd" ${planning.status === 'uitgevoerd' ? 'selected' : ''}>✅ Uitgevoerd</option>
                <option value="geannuleerd" ${planning.status === 'geannuleerd' ? 'selected' : ''}>❌ Geannuleerd</option>
              </select>
              <button class="btn btn-secondary edit-planning-btn" data-id="${planning.id}">✏️ Bewerken</button>
              <button class="btn btn-danger delete-planning-btn" data-id="${planning.id}">🗑️ Verwijderen</button>
            </div>
          </div>
        `;
      });

      html += `
        </div>
      `;
    }

    planningLijst.innerHTML = html;

    // Event listeners
    document.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', async function() {
        const id = this.dataset.id;
        const nieuweStatus = this.value;
        await updatePlanningStatus(id, nieuweStatus);
      });
    });

    document.querySelectorAll('.edit-planning-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkPlanning(btn.dataset.id));
    });

    document.querySelectorAll('.delete-planning-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderPlanning(btn.dataset.id));
    });

    document.querySelectorAll('.pdf-dag-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const datum = this.dataset.datum;
        genereerPDFVoorDag(datum);
      });
    });

    document.querySelectorAll('.ai-optimize-day-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const datum = this.dataset.datum;
        optimizeRouteVoorDag(datum);
      });
    });

    initSortable();

  } catch (err) {
    console.error('Fout bij laden planningen:', err);
    planningLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}
// ============================================================
// AI OPTIMALISATIE
// ============================================================
async function optimizeRouteVoorDag(datum) {
  if (isOptimizing) return;
  isOptimizing = true;
  showToast('🤖 Route wordt geoptimaliseerd...', 'info');

  try {
    const planningen = allePlanningen.filter(p => p.datum === datum);
    
    if (!planningen || planningen.length === 0) {
      showToast('⚠️ Geen ritten om te optimaliseren', 'warning');
      isOptimizing = false;
      return;
    }

    const startpunt = { lat: 51.0589, lng: 4.3740 };

    function berekenAfstand(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    const rittenMetAfstand = planningen.map(rit => {
      const adres = rit.adres;
      let afstand = Infinity;
      if (adres && adres.latitude && adres.longitude) {
        afstand = berekenAfstand(startpunt.lat, startpunt.lng, adres.latitude, adres.longitude);
      }
      return { ...rit, afstand };
    });

    rittenMetAfstand.sort((a, b) => a.afstand - b.afstand);

    for (let i = 0; i < rittenMetAfstand.length; i++) {
      const rit = rittenMetAfstand[i];
      const { error: updateError } = await supabase
        .from('planningen')
        .update({ dag_volgorde: i + 1 })
        .eq('id', rit.id);
      
      if (updateError) throw updateError;
    }

    await logActie('route geoptimaliseerd', 'planning', null, null, { 
      datum: datum,
      aantal_ritten: rittenMetAfstand.length 
    });

    showToast('✅ Route geoptimaliseerd!', 'success');
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij optimalisatie:', err);
    showToast('❌ Fout bij optimalisatie: ' + err.message, 'error');
  } finally {
    isOptimizing = false;
  }
}

// ============================================================
// INITIALISATIE
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔄 DOMContentLoaded event triggered');

  const auth = await requireAuth('index.html');
  if (!auth.isAuthenticated) {
    console.warn('⚠️ Niet ingelogd, redirect...');
    return;
  }

  await laadAdressenVoorSelect();
  await laadPlanningen();

  // ===== EVENT LISTENERS =====

  if (newPlanningBtn) {
    newPlanningBtn.addEventListener('click', () => {
      currentPlanningId = null;
      planningPopupTitle.textContent = 'Nieuwe planning';
      setValue('typeSelect', '');
      setValue('adresSelect', '');
      setValue('planningDatum', '');
      setValue('opmerkingen', '');
      setValue('aantalTonnen', '1');
      setValue('aantalLegeTonnen', '1');
      ophalingVelden.style.display = 'none';
      plaatsingVelden.style.display = 'none';
      planningPopup.style.display = 'flex';
    });
  }

  if (refreshPlanningBtn) {
    refreshPlanningBtn.addEventListener('click', laadPlanningen);
  }

  if (aiOptimizeBtn) {
    aiOptimizeBtn.addEventListener('click', async () => {
      const data = allePlanningen || [];
      if (data.length === 0) {
        showToast('⚠️ Geen ritten om te optimaliseren', 'warning');
        return;
      }
      const recentsteDatum = data.sort((a, b) => new Date(b.datum) - new Date(a.datum))[0]?.datum;
      if (recentsteDatum) {
        await optimizeRouteVoorDag(recentsteDatum);
      }
    });
  }

  if (savePlanningBtn) {
    savePlanningBtn.addEventListener('click', savePlanning);
  }

  if (closePlanningPopup) {
    closePlanningPopup.addEventListener('click', () => {
      planningPopup.style.display = 'none';
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', function() {
      if (this.value === 'ophaling') {
        ophalingVelden.style.display = 'block';
        plaatsingVelden.style.display = 'none';
      } else if (this.value === 'plaatsing') {
        ophalingVelden.style.display = 'none';
        plaatsingVelden.style.display = 'block';
      } else {
        ophalingVelden.style.display = 'none';
        plaatsingVelden.style.display = 'none';
      }
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === planningPopup) {
      planningPopup.style.display = 'none';
    }
  });

  console.log('✅ Planning pagina geïnitialiseerd!');
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('🔄 DOM al geladen, trigger direct...');
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

console.log('✅ planning.js geladen!');