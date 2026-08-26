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
// PDF GENERATIE (Kaart-stijl met alle details voor chauffeur)
// ============================================================
async function genereerPDFVoorDag(datum) {
  const planningen = allePlanningen.filter(p => p.datum === datum);

  if (planningen.length === 0) {
    showToast('⚠️ Geen ritten om te exporteren', 'warning');
    return;
  }

  try {
    showToast('📄 PDF wordt gegenereerd...', 'info');

    const sortedPlanningen = [...planningen].sort((a, b) => (a.dag_volgorde || 0) - (b.dag_volgorde || 0));

    let printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Route-overzicht</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            padding: 30px; 
            background: #f5f7fa;
            color: #333;
          }
          
          /* Header */
          .header {
            background: white;
            padding: 20px 25px;
            border-radius: 10px;
            margin-bottom: 25px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
          }
          .header h1 {
            color: #2c7da0;
            font-size: 24px;
            margin: 0;
          }
          .header p {
            color: #666;
            font-size: 14px;
            margin: 0;
          }
          .header .totaal {
            background: #e8f4f8;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            color: #2c7da0;
            font-weight: 600;
          }
          
          /* Rit kaart */
          .rit-card {
            background: white;
            border-radius: 10px;
            padding: 18px 22px;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            border-left: 5px solid #2c7da0;
            page-break-inside: avoid;
          }
          .rit-card.status-gepland { border-left-color: #ffc107; }
          .rit-card.status-uitgevoerd { border-left-color: #28a745; }
          .rit-card.status-geannuleerd { border-left-color: #dc3545; }
          
          .rit-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
          }
          .rit-nummer {
            background: #2c7da0;
            color: white;
            padding: 4px 14px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 700;
          }
          .rit-naam {
            font-size: 20px;
            font-weight: 700;
            color: #2c7da0;
            flex: 1;
          }
          .rit-status {
            padding: 4px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
          }
          .rit-status.gepland { background: #fff3cd; color: #856404; }
          .rit-status.uitgevoerd { background: #d4edda; color: #155724; }
          .rit-status.geannuleerd { background: #f8d7da; color: #721c24; }
          
          .rit-body {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .rit-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 4px 0;
          }
          .rit-label {
            font-weight: 600;
            color: #666;
            min-width: 130px;
            font-size: 13px;
          }
          .rit-value {
            font-size: 14px;
            color: #333;
            flex: 1;
            word-break: break-word;
          }
          
          .opmerking-box {
            background: #fff8e1;
            padding: 10px 14px;
            border-radius: 6px;
            border-left: 4px solid #ffc107;
            margin-top: 6px;
            width: 100%;
          }
          .opmerking-box .rit-label {
            min-width: auto;
            color: #856404;
            font-weight: 600;
            display: block;
            margin-bottom: 3px;
          }
          .opmerking-box .rit-value {
            color: #6d5d00;
          }
          
          .extra-info-box {
            background: #e3f2fd;
            padding: 10px 14px;
            border-radius: 6px;
            border-left: 4px solid #2196f3;
            margin-top: 6px;
            width: 100%;
          }
          .extra-info-box .rit-label {
            min-width: auto;
            color: #0d47a1;
            font-weight: 600;
            display: block;
            margin-bottom: 3px;
          }
          .extra-info-box .rit-value {
            color: #0d47a1;
          }
          
          .footer {
            margin-top: 25px;
            padding: 15px;
            background: white;
            border-radius: 10px;
            text-align: center;
            color: #999;
            font-size: 11px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          }
          
          .no-print {
            text-align: center;
            margin-top: 20px;
            padding: 15px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          }
          .no-print button {
            padding: 12px 40px;
            font-size: 16px;
            cursor: pointer;
            border: none;
            border-radius: 6px;
            font-weight: 600;
          }
          .btn-print {
            background: #2c7da0;
            color: white;
          }
          .btn-print:hover { background: #1f5e7e; }
          .btn-close {
            background: #6c757d;
            color: white;
          }
          .btn-close:hover { background: #5a6268; }
          
          @media print {
            body { background: white; padding: 15px; }
            .header { box-shadow: none; border: 1px solid #eee; }
            .rit-card { box-shadow: none; border: 1px solid #eee; page-break-inside: avoid; }
            .footer { box-shadow: none; border: 1px solid #eee; }
            .no-print { display: none; }
            .rit-row { padding: 3px 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>📅 Route-overzicht</h1>
            <p style="margin-top:4px;">${formatDate(datum)}</p>
          </div>
          <div class="totaal">🚗 ${sortedPlanningen.length} ritten</div>
        </div>
    `;

    sortedPlanningen.forEach((planning, index) => {
      const statusClass = planning.status || 'gepland';
      const typeLabel = planning.type === 'ophaling' ? '📦 Ophaling' : '🚚 Plaatsing';
      
      // Details
      let detailsHtml = '';
      if (planning.type === 'ophaling' && planning.aantal_tonnen) {
        detailsHtml += `
          <div class="rit-row">
            <span class="rit-label">Aantal tonnen</span>
            <span class="rit-value">${planning.aantal_tonnen} ton(nen)</span>
          </div>
        `;
      } else if (planning.type === 'plaatsing' && planning.aantal_lege_tonnen) {
        detailsHtml += `
          <div class="rit-row">
            <span class="rit-label">Lege tonnen</span>
            <span class="rit-value">${planning.aantal_lege_tonnen} lege ton(nen)</span>
          </div>
        `;
      }

      // Telefoon
      if (planning.adres?.telefoon) {
        detailsHtml += `
          <div class="rit-row">
            <span class="rit-label">📞 Telefoon</span>
            <span class="rit-value">${escapeHtml(planning.adres.telefoon)}</span>
          </div>
        `;
      }

      // 🔥 Contactpersoon (toegevoegd)
      if (planning.adres?.contactpersoon_naam) {
        detailsHtml += `
          <div class="rit-row">
            <span class="rit-label">👤 Contactpersoon</span>
            <span class="rit-value">${escapeHtml(planning.adres.contactpersoon_naam)}</span>
          </div>
        `;
      }

      // Extra info (parkeren, route, laadperron, etc.)
      if (planning.adres?.extra_info) {
        detailsHtml += `
          <div class="extra-info-box">
            <span class="rit-label">📝 Extra info</span>
            <span class="rit-value">${escapeHtml(planning.adres.extra_info)}</span>
          </div>
        `;
      }

      // Opmerkingen (cruciaal voor chauffeur)
      if (planning.opmerkingen) {
        detailsHtml += `
          <div class="opmerking-box">
            <span class="rit-label">💬 Opmerking</span>
            <span class="rit-value">${escapeHtml(planning.opmerkingen)}</span>
          </div>
        `;
      }

      printContent += `
        <div class="rit-card status-${statusClass}">
          <div class="rit-header">
            <span class="rit-nummer">#${index + 1}</span>
            <span class="rit-naam">${escapeHtml(planning.adres?.instelling_naam || 'Onbekend')}</span>
            <span class="rit-status ${statusClass}">${statusClass}</span>
          </div>
          <div class="rit-body">
            <div class="rit-row">
              <span class="rit-label">📍 Adres</span>
              <span class="rit-value">${escapeHtml(planning.adres?.straat || '')}, ${escapeHtml(planning.adres?.plaats || '')}</span>
            </div>
            <div class="rit-row">
              <span class="rit-label">📋 Type</span>
              <span class="rit-value">${typeLabel}</span>
            </div>
            ${detailsHtml}
          </div>
        </div>
      `;
    });

    printContent += `
        <div class="footer">
          <p>Gegenereerd op ${new Date().toLocaleString('nl-NL')}</p>
        </div>
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">🖨️ Print / PDF opslaan</button>
          <button class="btn-close" onclick="window.close()" style="margin-left:10px;">❌ Sluiten</button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
      showToast('❌ Popup geblokkeerd! Sta popups toe voor deze site.', 'error');
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    printWindow.onload = function() {
      setTimeout(function() {
        printWindow.print();
      }, 500);
    };

    await logActie('pdf geëxporteerd', 'planning', null, null, { datum: datum });

  } catch (err) {
    console.error('Fout bij PDF generatie:', err);
    showToast('❌ Fout bij PDF generatie: ' + err.message, 'error');
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