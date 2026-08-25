// ============================================================
// PLANNING - Planning pagina (originele functionaliteit)
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
  const d = new Date(date);
  return d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateLong(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
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
// PLANNINGEN LADEN (Alle dagen, gesorteerd op datum)
// ============================================================
async function laadPlanningen() {
  console.log('📋 laadPlanningen aangeroepen...');
  if (!planningLijst) {
    console.warn('⚠️ planningLijst element niet gevonden');
    return;
  }
  planningLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    // Haal ALLE planningen op (geen datumfilter)
    const { data, error } = await supabase
      .from('planningen')
      .select('*')
      .order('datum', { ascending: false })  // Nieuwste datum eerst
      .order('dag_volgorde', { ascending: true });

    if (error) {
      console.error('❌ Fout bij laden:', error);
      throw error;
    }
    
    console.log('📊 Aantal planningen gevonden:', data?.length || 0);

    if (!data || data.length === 0) {
      planningLijst.innerHTML = `
        <div class="geen-planningen">
          <p>📅 Geen planningen gevonden</p>
          <p style="color: #6c757d; font-size: 0.9rem;">Klik op "+ Nieuwe planning" om er een toe te voegen.</p>
        </div>
      `;
      return;
    }

    // Haal adressen apart op
    const adresIds = [...new Set(data.map(p => p.adres_id).filter(id => id))];
    let adressenMap = {};
    if (adresIds.length > 0) {
      const { data: adressen, error: adresError } = await supabase
        .from('adressen')
        .select('id, instelling_naam, straat, plaats, telefoon, extra_info')
        .in('id', adresIds);
      
      if (!adresError && adressen) {
        adressen.forEach(a => {
          adressenMap[a.id] = a;
        });
      }
    }

    // Voeg adres toe aan elke planning
    const planningenMetAdres = data.map(p => ({
      ...p,
      adres: adressenMap[p.adres_id] || null
    }));

    allePlanningen = planningenMetAdres;

    // Groepeer op datum
    const grouped = {};
    planningenMetAdres.forEach(p => {
      if (!grouped[p.datum]) {
        grouped[p.datum] = [];
      }
      grouped[p.datum].push(p);
    });

    // Sorteer datums (nieuwste eerst)
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      return new Date(b) - new Date(a);
    });

    let html = '';

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

        let extraInfo = '';
        if (planning.type === 'ophaling' && planning.aantal_tonnen) {
          extraInfo = `📦 ${planning.aantal_tonnen} ton(nen)`;
        } else if (planning.type === 'plaatsing' && planning.aantal_lege_tonnen) {
          extraInfo = `📦 ${planning.aantal_lege_tonnen} lege ton(nen)`;
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
              <p>📋 ${typeIcon} ${typeLabel} ${extraInfo ? `- ${extraInfo}` : ''}</p>
              ${planning.adres?.telefoon ? `<p>📞 ${escapeHtml(planning.adres.telefoon)}</p>` : ''}
              ${planning.adres?.extra_info ? `<p class="planning-extra-info">📝 ${escapeHtml(planning.adres.extra_info)}</p>` : ''}
              ${planning.opmerkingen ? `<p class="planning-opmerking">💬 ${escapeHtml(planning.opmerkingen)}</p>` : ''}
            </div>
            <div class="planning-buttons">
              <select class="status-select" data-id="${planning.id}">
                <option value="gepland" ${planning.status === 'gepland' ? 'selected' : ''}>📋 Gepland</option>
                <option value="uitgevoerd" ${planning.status === 'uitgevoerd' ? 'selected' : ''}>✅ Uitgevoerd</option>
                <option value="geannuleerd" ${planning.status === 'geannuleerd' ? 'selected' : ''}>❌ Geannuleerd</option>
              </select>
              <button class="btn btn-secondary edit-planning-btn" data-id="${planning.id}">✏️</button>
              <button class="btn btn-danger delete-planning-btn" data-id="${planning.id}">🗑️</button>
            </div>
          </div>
        `;
      });

      html += `
        </div>
      `;
    }

    planningLijst.innerHTML = html;

    // Event listeners voor status select
    document.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', async function() {
        const id = this.dataset.id;
        const nieuweStatus = this.value;
        await updatePlanningStatus(id, nieuweStatus);
      });
    });

    // Event listeners voor bewerk knoppen
    document.querySelectorAll('.edit-planning-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkPlanning(btn.dataset.id));
    });

    // Event listeners voor verwijder knoppen
    document.querySelectorAll('.delete-planning-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderPlanning(btn.dataset.id));
    });

    // Event listeners voor PDF knoppen
    document.querySelectorAll('.pdf-dag-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const datum = this.dataset.datum;
        genereerPDFVoorDag(datum);
      });
    });

    // Event listeners voor AI optimalisatie knoppen
    document.querySelectorAll('.ai-optimize-day-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const datum = this.dataset.datum;
        optimizeRouteVoorDag(datum);
      });
    });

    // Init sortable voor elke dag
    initSortable();

  } catch (err) {
    console.error('❌ Fout bij laden planningen:', err);
    planningLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== SORTABLE INIT =====
function initSortable() {
  // Vernietig oude sortable instances
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
    console.log('🔄 Route volgorde updaten voor', datum, ':', updates);
    
    for (const update of updates) {
      const { error } = await supabase
        .from('planningen')
        .update({ dag_volgorde: update.volgorde })
        .eq('id', update.id);
      
      if (error) throw error;
    }

    // LOG: Route volgorde aangepast
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

    // LOG: Status gewijzigd
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
      // Haal de hoogste dag_volgorde op voor deze datum
      const { data: maxData } = await supabase
        .from('planningen')
        .select('dag_volgorde')
        .eq('datum', datum)
        .order('dag_volgorde', { ascending: false })
        .limit(1);
      
      const maxVolgorde = maxData && maxData.length > 0 ? maxData[0].dag_volgorde : 0;
      planningData.dag_volgorde = maxVolgorde + 1;

      result = await supabase
        .from('planningen')
        .insert([planningData]);
    }

    if (result.error) throw result.error;

    // LOG: Planning toegevoegd of bijgewerkt
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

    // LOG: Planning verwijderd
    await logActie('verwijderd', 'planning', id);

    showToast('✅ Planning verwijderd!', 'success');
    laadPlanningen();
  } catch (err) {
    console.error('Fout bij verwijderen:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ============================================================
// PDF GENERATIE PER DAG
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

    let html = `
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; }
          h1 { color: #2c7da0; border-bottom: 2px solid #2c7da0; padding-bottom: 10px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .header p { color: #666; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #2c7da0; color: white; padding: 10px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          .status-gepland { color: #856404; background: #fff3cd; padding: 2px 8px; border-radius: 4px; }
          .status-uitgevoerd { color: #155724; background: #d4edda; padding: 2px 8px; border-radius: 4px; }
          .status-geannuleerd { color: #721c24; background: #f8d7da; padding: 2px 8px; border-radius: 4px; }
          .footer { margin-top: 30px; color: #999; font-size: 12px; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📅 Route-overzicht</h1>
          <p>${formatDateLong(datum)}</p>
        </div>
        <p><strong>Totaal ritten:</strong> ${sortedPlanningen.length}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ziekenhuis</th>
              <th>Adres</th>
              <th>Type</th>
              <th>Details</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    sortedPlanningen.forEach((planning, index) => {
      const statusClass = planning.status === 'gepland' ? 'status-gepland' : 
                          (planning.status === 'uitgevoerd' ? 'status-uitgevoerd' : 'status-geannuleerd');
      const typeIcon = planning.type === 'ophaling' ? '📦 Ophaling' : '🚚 Plaatsing';
      let details = '';
      if (planning.type === 'ophaling' && planning.aantal_tonnen) {
        details = `${planning.aantal_tonnen} ton(nen)`;
      } else if (planning.type === 'plaatsing' && planning.aantal_lege_tonnen) {
        details = `${planning.aantal_lege_tonnen} lege ton(nen)`;
      }

      html += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(planning.adres?.instelling_naam || 'Onbekend')}</strong></td>
          <td>${escapeHtml(planning.adres?.straat || '')}, ${escapeHtml(planning.adres?.plaats || '')}</td>
          <td>${typeIcon}</td>
          <td>${details}</td>
          <td><span class="${statusClass}">${planning.status || 'gepland'}</span></td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <div class="footer">
          <p>Gegenereerd op ${new Date().toLocaleString('nl-NL')}</p>
        </div>
      </body>
      </html>
    `;

    const opt = {
      margin: 1,
      filename: `route_${datum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.innerHTML = html;
    document.body.appendChild(tempContainer);

    await html2pdf().set(opt).from(tempContainer).save();
    document.body.removeChild(tempContainer);

    await logActie('pdf geëxporteerd', 'planning', null, null, { datum: datum });

    showToast('✅ PDF succesvol gegenereerd!', 'success');
  } catch (err) {
    console.error('Fout bij PDF generatie:', err);
    showToast('❌ Fout bij PDF generatie: ' + err.message, 'error');
  }
}

// ============================================================
// AI OPTIMALISATIE PER DAG
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

    // Eenvoudige optimalisatie: sorteer op afstand tot startpunt
    const startpunt = { lat: 51.0589, lng: 4.3740 }; // Schoonmansveld 48, 2870 Puurs

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

  // Nieuwe planning
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

  // AI Optimalisatie - algemeen (voor alle dagen)
  if (aiOptimizeBtn) {
    aiOptimizeBtn.addEventListener('click', async () => {
      // Optimaliseer de meest recente dag met ritten
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

  // Sluiten bij klik buiten popups
  window.addEventListener('click', (e) => {
    if (e.target === planningPopup) {
      planningPopup.style.display = 'none';
    }
  });

  console.log('✅ Planning pagina geïnitialiseerd!');
});

// Als DOM al geladen is
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('🔄 DOM al geladen, trigger direct...');
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

console.log('✅ planning.js geladen!');