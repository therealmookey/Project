// ============================================================
// PLANNING - Planning pagina (met logging)
// ============================================================
console.log('🚀 planning.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase, logActie } from './core/supabase.js';  // 🔥 logActie toegevoegd

console.log('✅ Imports geladen!');

// ===== STATE =====
let allePlanningen = [];
let alleAdressen = [];
let currentPlanningId = null;
let huidigeDatum = new Date();

// ===== DOM ELEMENTEN =====
const planningLijst = document.getElementById('planningLijst');
const newPlanningBtn = document.getElementById('newPlanningBtn');
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
      .select('id, instelling_naam')
      .order('instelling_naam');
    if (error) throw error;
    alleAdressen = data || [];
    adresSelect.innerHTML = '<option value="">Kies een adres...</option>';
    alleAdressen.forEach(a => {
      const option = document.createElement('option');
      option.value = a.id;
      option.textContent = a.instelling_naam;
      adresSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Fout bij laden adressen:', err);
  }
}

// ===== PLANNINGEN LADEN =====
async function laadPlanningen() {
  console.log('📋 laadPlanningen aangeroepen...');
  if (!planningLijst) return;
  planningLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    const { data, error } = await supabase
      .from('planningen')
      .select('*, adres:adres_id (instelling_naam, straat, plaats)')
      .order('datum', { ascending: true })
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
    const sortedDates = Object.keys(grouped).sort();

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
          </div>
        </div>
      `;

      items.forEach((planning, index) => {
        const statusClass = planning.status === 'gepland' ? 'status-gepland' : 
                            (planning.status === 'uitgevoerd' ? 'status-uitgevoerd' : 'status-geannuleerd');
        const typeIcon = planning.type === 'ophaling' ? '📦' : '🚚';
        const typeLabel = planning.type === 'ophaling' ? 'Ophaling' : 'Plaatsing';
        const volgorde = planning.dag_volgorde || index + 1;

        html += `
          <div class="planning-item" data-id="${planning.id}">
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
              ${planning.opmerkingen ? `<p>📝 ${escapeHtml(planning.opmerkingen)}</p>` : ''}
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
      btn.addEventListener('click', () => {
        const datum = btn.dataset.datum;
        genereerPDFVoorDag(datum);
      });
    });

    // Sortable voor drag & drop
    initSortable();

  } catch (err) {
    console.error('Fout bij laden planningen:', err);
    planningLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
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

    // 🔥 LOG: Status gewijzigd
    await logActie('status gewijzigd', 'planning', id, null, { nieuweStatus });

    showToast('✅ Status bijgewerkt!', 'success');
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij updaten status:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== PLANNING OPSLAAN =====
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

    // 🔥 LOG: Planning toegevoegd of bijgewerkt
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

// ===== PLANNING BEWERKEN =====
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

// ===== PLANNING VERWIJDEREN =====
async function verwijderPlanning(id) {
  if (!confirm('Weet je zeker dat je deze planning wilt verwijderen?')) return;

  try {
    const { error } = await supabase
      .from('planningen')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // 🔥 LOG: Planning verwijderd
    await logActie('verwijderd', 'planning', id);

    showToast('✅ Planning verwijderd!', 'success');
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij verwijderen:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== SORTABLE INIT =====
function initSortable() {
  // Sortable logica hier...
}

// ===== PDF GENERATIE =====
function genereerPDFVoorDag(datum) {
  // PDF generatie logica hier...
}

// ===== INITIALISATIE =====
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔄 DOMContentLoaded event triggered');

  const auth = await requireAuth('index.html');
  if (!auth.isAuthenticated) {
    console.warn('⚠️ Niet ingelogd, redirect...');
    return;
  }

  await laadAdressenVoorSelect();
  await laadPlanningen();

  // Type change
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

  if (savePlanningBtn) {
    savePlanningBtn.addEventListener('click', savePlanning);
  }

  if (closePlanningPopup) {
    closePlanningPopup.addEventListener('click', () => {
      planningPopup.style.display = 'none';
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
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

console.log('✅ planning.js geladen!');