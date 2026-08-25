// ============================================================
// REGISTRATIES - Registraties pagina (met logging)
// ============================================================
console.log('🚀 registraties.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase, logActie } from './core/supabase.js';  // 🔥 logActie toegevoegd

console.log('✅ Imports geladen!');

// ===== STATE =====
let alleRegistraties = [];
let alleZiekenhuizen = [];
let currentRegistratieId = null;
let huidigeFilters = {
  ziekenhuis: '',
  datumVanaf: '',
  datumTot: '',
  type: 'alles'
};

// ===== DOM ELEMENTEN =====
const registratiesLijst = document.getElementById('registratiesLijst');
const addRegistratieBtn = document.getElementById('addRegistratieBtn');
const registratiePopup = document.getElementById('registratiePopup');
const popupTitle = document.getElementById('popupTitle');
const registratieType = document.getElementById('registratieType');
const ziekenhuisSelect = document.getElementById('ziekenhuisSelect');
const registratieDatum = document.getElementById('registratieDatum');
const gewicht = document.getElementById('gewicht');
const opmerkingenReg = document.getElementById('opmerkingen');
const saveRegistratieBtn = document.getElementById('saveRegistratieBtn');
const closeRegistratiePopup = document.getElementById('closeRegistratiePopup');
const ophalingVeldenReg = document.getElementById('ophalingVeldenReg');

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

// ===== ZIEKENHUIZEN LADEN =====
async function laadZiekenhuizenVoorSelect() {
  try {
    const { data, error } = await supabase
      .from('adressen')
      .select('id, instelling_naam')
      .order('instelling_naam');
    if (error) throw error;
    alleZiekenhuizen = data || [];
    ziekenhuisSelect.innerHTML = '<option value="">Kies een ziekenhuis...</option>';
    alleZiekenhuizen.forEach(z => {
      const option = document.createElement('option');
      option.value = z.id;
      option.textContent = z.instelling_naam;
      ziekenhuisSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Fout bij laden ziekenhuizen:', err);
  }
}

// ===== REGISTRATIES LADEN =====
async function laadRegistraties() {
  console.log('📋 laadRegistraties aangeroepen...');
  if (!registratiesLijst) return;
  registratiesLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    let query = supabase
      .from('ophaalregistraties')
      .select('*, ziekenhuis:ziekenhuis_id (instelling_naam)')
      .order('registratiedatum', { ascending: false });

    if (huidigeFilters.ziekenhuis) {
      query = query.eq('ziekenhuis_id', parseInt(huidigeFilters.ziekenhuis));
    }
    if (huidigeFilters.datumVanaf) {
      query = query.gte('registratiedatum', huidigeFilters.datumVanaf);
    }
    if (huidigeFilters.datumTot) {
      query = query.lte('registratiedatum', huidigeFilters.datumTot);
    }
    if (huidigeFilters.type && huidigeFilters.type !== 'alles') {
      query = query.eq('type', huidigeFilters.type);
    }

    const { data, error } = await query;
    if (error) throw error;
    alleRegistraties = data || [];

    if (alleRegistraties.length === 0) {
      registratiesLijst.innerHTML = '<p>Geen registraties gevonden.</p>';
      return;
    }

    let html = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left;">Datum</th>
              <th style="padding: 12px; text-align: left;">Ziekenhuis</th>
              <th style="padding: 12px; text-align: left;">Type</th>
              <th style="padding: 12px; text-align: left;">Gewicht (kg)</th>
              <th style="padding: 12px; text-align: left;">Opmerkingen</th>
              <th style="padding: 12px; text-align: left;">Acties</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const reg of alleRegistraties) {
      const typeIcon = reg.type === 'ophaling' ? '📦' : '🔄';
      const typeLabel = reg.type === 'ophaling' ? 'Ophaling' : 'Opstart';

      html += `
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 12px;">${formatDate(reg.registratiedatum)}</td>
          <td style="padding: 12px;"><strong>${escapeHtml(reg.ziekenhuis?.instelling_naam || 'Onbekend')}</strong></td>
          <td style="padding: 12px;">${typeIcon} ${typeLabel}</td>
          <td style="padding: 12px;">${reg.gewicht || '-'}</td>
          <td style="padding: 12px;">${escapeHtml(reg.opmerkingen || '-')}</td>
          <td style="padding: 12px;">
            <button class="btn btn-secondary edit-reg-btn" data-id="${reg.id}">✏️ Bewerken</button>
            <button class="btn btn-danger delete-reg-btn" data-id="${reg.id}">🗑️ Verwijderen</button>
          </td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    registratiesLijst.innerHTML = html;

    document.querySelectorAll('.edit-reg-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkRegistratie(btn.dataset.id));
    });

    document.querySelectorAll('.delete-reg-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderRegistratie(btn.dataset.id));
    });

  } catch (err) {
    console.error('Fout bij laden registraties:', err);
    registratiesLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== REGISTRATIE OPSLAAN =====
async function saveRegistratie() {
  const type = getValue('registratieType');
  const ziekenhuisId = getValue('ziekenhuisSelect');
  const datum = getValue('registratieDatum');
  const gewichtVal = getValue('gewicht');
  const opmerking = getValue('opmerkingen');

  if (!type || !ziekenhuisId || !datum) {
    showToast('Vul alle verplichte velden in', 'error');
    return;
  }

  const registratieData = {
    type: type,
    ziekenhuis_id: parseInt(ziekenhuisId),
    registratiedatum: datum,
    opmerkingen: opmerking || null
  };

  if (type === 'ophaling') {
    if (!gewichtVal) {
      showToast('Vul het gewicht in', 'error');
      return;
    }
    registratieData.gewicht = parseFloat(gewichtVal);
  }

  try {
    let result;
    const isBewerken = !!currentRegistratieId;

    if (isBewerken) {
      result = await supabase
        .from('ophaalregistraties')
        .update(registratieData)
        .eq('id', currentRegistratieId);
    } else {
      result = await supabase
        .from('ophaalregistraties')
        .insert([registratieData]);
    }

    if (result.error) throw result.error;

    // 🔥 LOG: Registratie toegevoegd of bijgewerkt
    const actie = isBewerken ? 'bijgewerkt' : 'toegevoegd';
    const entityId = isBewerken ? currentRegistratieId : result.data?.[0]?.id;
    const ziekenhuisNaam = alleZiekenhuizen.find(z => z.id === parseInt(ziekenhuisId))?.instelling_naam || 'Onbekend';
    await logActie(actie, 'registraties', entityId, `Registratie voor ${ziekenhuisNaam} op ${datum}`);

    showToast('✅ Registratie opgeslagen!', 'success');
    registratiePopup.style.display = 'none';
    laadRegistraties();
  } catch (err) {
    console.error('Fout bij opslaan:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== REGISTRATIE BEWERKEN =====
async function bewerkRegistratie(id) {
  try {
    const { data, error } = await supabase
      .from('ophaalregistraties')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentRegistratieId = id;
    popupTitle.textContent = 'Registratie bewerken';
    setValue('registratieType', data.type);
    setValue('ziekenhuisSelect', data.ziekenhuis_id);
    setValue('registratieDatum', data.registratiedatum);
    setValue('gewicht', data.gewicht || '');
    setValue('opmerkingen', data.opmerkingen || '');

    if (data.type === 'ophaling') {
      ophalingVeldenReg.style.display = 'block';
    } else {
      ophalingVeldenReg.style.display = 'none';
    }

    registratiePopup.style.display = 'flex';
  } catch (err) {
    console.error('Fout bij bewerken:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== REGISTRATIE VERWIJDEREN =====
async function verwijderRegistratie(id) {
  if (!confirm('Weet je zeker dat je deze registratie wilt verwijderen?')) return;

  try {
    const { error } = await supabase
      .from('ophaalregistraties')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // 🔥 LOG: Registratie verwijderd
    await logActie('verwijderd', 'registraties', id);

    showToast('✅ Registratie verwijderd!', 'success');
    laadRegistraties();
  } catch (err) {
    console.error('Fout bij verwijderen:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== INITIALISATIE =====
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔄 DOMContentLoaded event triggered');

  const auth = await requireAuth('index.html');
  if (!auth.isAuthenticated) {
    console.warn('⚠️ Niet ingelogd, redirect...');
    return;
  }

  await laadZiekenhuizenVoorSelect();
  await laadRegistraties();

  // Type change
  if (registratieType) {
    registratieType.addEventListener('change', function() {
      if (this.value === 'ophaling') {
        ophalingVeldenReg.style.display = 'block';
      } else {
        ophalingVeldenReg.style.display = 'none';
      }
    });
  }

  if (addRegistratieBtn) {
    addRegistratieBtn.addEventListener('click', () => {
      currentRegistratieId = null;
      popupTitle.textContent = 'Nieuwe registratie';
      setValue('registratieType', 'ophaling');
      setValue('ziekenhuisSelect', '');
      setValue('registratieDatum', '');
      setValue('gewicht', '');
      setValue('opmerkingen', '');
      ophalingVeldenReg.style.display = 'block';
      registratiePopup.style.display = 'flex';
    });
  }

  if (saveRegistratieBtn) {
    saveRegistratieBtn.addEventListener('click', saveRegistratie);
  }

  if (closeRegistratiePopup) {
    closeRegistratiePopup.addEventListener('click', () => {
      registratiePopup.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === registratiePopup) {
      registratiePopup.style.display = 'none';
    }
  });

  console.log('✅ Registraties pagina geïnitialiseerd!');
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

console.log('✅ registraties.js geladen!');