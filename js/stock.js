// ============================================================
// STOCK - Voorraadbeheer (met logging)
// ============================================================
console.log('🚀 stock.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase, logActie } from './core/supabase.js';  // 🔥 logActie toegevoegd

console.log('✅ Imports geladen!');

// ===== STATE =====
let alleItems = [];
let huidigeFilters = {
  zoekterm: '',
  type: 'alles',
  status: 'alles'
};
let currentItemId = null;
let currentCombinatieId = null;

// ===== DOM ELEMENTEN =====
const stockLijst = document.getElementById('stockLijst');
const addItemBtn = document.getElementById('addItemBtn');
const addCombinatieBtn = document.getElementById('addCombinatieBtn');
const refreshBtn = document.getElementById('refreshBtn');
const searchStock = document.getElementById('searchStock');
const typeFilter = document.getElementById('typeFilter');
const statusFilter = document.getElementById('statusFilter');
const filterBtn = document.getElementById('filterBtn');
const resetFilterBtn = document.getElementById('resetFilterBtn');
const itemPopup = document.getElementById('itemPopup');
const popupTitle = document.getElementById('popupTitle');
const itemCode = document.getElementById('itemCode');
const itemOmschrijving = document.getElementById('itemOmschrijving');
const itemAantal = document.getElementById('itemAantal');
const itemMinimum = document.getElementById('itemMinimum');
const itemLocatie = document.getElementById('itemLocatie');
const saveItemBtn = document.getElementById('saveItemBtn');
const closeItemPopup = document.getElementById('closeItemPopup');
const combinatieVelden = document.querySelector('.combinatie-velden');

// ===== HULPFUNCTIES =====
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// ===== STOCK LADEN =====
async function laadStock() {
  console.log('📋 laadStock aangeroepen...');
  if (!stockLijst) return;
  stockLijst.innerHTML = '<p>Bezig met laden...</p>';

  try {
    let query = supabase
      .from('stock_items')
      .select('*')
      .order('omschrijving');

    const { data, error } = await query;
    if (error) throw error;
    alleItems = data || [];

    if (alleItems.length === 0) {
      stockLijst.innerHTML = '<p>Geen voorraaditems gevonden. Klik op "+ Nieuw item" om er een toe te voegen.</p>';
      return;
    }

    let html = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; text-align: left;">Code</th>
              <th style="padding: 12px; text-align: left;">Omschrijving</th>
              <th style="padding: 12px; text-align: left;">Aantal</th>
              <th style="padding: 12px; text-align: left;">Minimum</th>
              <th style="padding: 12px; text-align: left;">Status</th>
              <th style="padding: 12px; text-align: left;">Locatie</th>
              <th style="padding: 12px; text-align: left;">Acties</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const item of alleItems) {
      const status = item.aantal <= 0 ? 'Op' : (item.aantal < item.minimum_stock ? 'Laag' : 'Voldoende');
      const statusClass = status === 'Op' ? 'status-op' : (status === 'Laag' ? 'status-laag' : 'status-voldoende');

      html += `
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 12px;"><strong>${escapeHtml(item.item_code)}</strong></td>
          <td style="padding: 12px;">${escapeHtml(item.omschrijving)}</td>
          <td style="padding: 12px;">${item.aantal}</td>
          <td style="padding: 12px;">${item.minimum_stock}</td>
          <td style="padding: 12px;"><span class="stock-status ${statusClass}">${status}</span></td>
          <td style="padding: 12px;">${escapeHtml(item.locatie || '-')}</td>
          <td style="padding: 12px;">
            <button class="btn btn-secondary edit-item-btn" data-id="${item.id}">✏️ Bewerken</button>
            <button class="btn btn-warning mutatie-btn" data-id="${item.id}" data-code="${escapeHtml(item.item_code)}" data-aantal="${item.aantal}">📦 Mutatie</button>
            ${!item.is_combinatie ? `<button class="btn btn-danger delete-item-btn" data-id="${item.id}">🗑️ Verwijderen</button>` : ''}
          </td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    stockLijst.innerHTML = html;

    document.querySelectorAll('.edit-item-btn').forEach(btn => {
      btn.addEventListener('click', () => bewerkItem(btn.dataset.id));
    });

    document.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', () => verwijderItem(btn.dataset.id));
    });

    document.querySelectorAll('.mutatie-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const code = btn.dataset.code;
        const aantal = parseInt(btn.dataset.aantal);
        toonMutatiePopup(id, code, aantal);
      });
    });

  } catch (err) {
    console.error('Fout bij laden stock:', err);
    stockLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
  }
}

// ===== ITEM OPSLAAN =====
async function saveItem() {
  const code = getValue('itemCode');
  const omschrijving = getValue('itemOmschrijving');
  const aantal = parseInt(getValue('itemAantal')) || 0;
  const minimum = parseInt(getValue('itemMinimum')) || 5;
  const locatie = getValue('itemLocatie') || null;
  const isCombinatie = document.getElementById('itemIsCombinatie')?.checked || false;

  if (!code || !omschrijving) {
    showToast('Vul code en omschrijving in', 'error');
    return;
  }

  const itemData = {
    item_code: code,
    omschrijving: omschrijving,
    aantal: aantal,
    minimum_stock: minimum,
    locatie: locatie,
    is_combinatie: isCombinatie
  };

  try {
    let result;
    const isBewerken = !!currentItemId;

    if (isBewerken) {
      result = await supabase
        .from('stock_items')
        .update(itemData)
        .eq('id', currentItemId);
    } else {
      result = await supabase
        .from('stock_items')
        .insert([itemData]);
    }

    if (result.error) throw result.error;

    // 🔥 LOG: Item toegevoegd of bijgewerkt
    const actie = isBewerken ? 'bijgewerkt' : 'toegevoegd';
    const entityId = isBewerken ? currentItemId : result.data?.[0]?.id;
    await logActie(actie, 'stock', entityId, code);

    showToast('✅ Item opgeslagen!', 'success');
    itemPopup.style.display = 'none';
    laadStock();
  } catch (err) {
    console.error('Fout bij opslaan:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== ITEM BEWERKEN =====
async function bewerkItem(id) {
  try {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentItemId = id;
    popupTitle.textContent = 'Item bewerken';
    setValue('itemCode', data.item_code);
    setValue('itemOmschrijving', data.omschrijving);
    setValue('itemAantal', data.aantal);
    setValue('itemMinimum', data.minimum_stock);
    setValue('itemLocatie', data.locatie || '');
    
    const isCombinatie = document.getElementById('itemIsCombinatie');
    if (isCombinatie) {
      isCombinatie.checked = data.is_combinatie || false;
    }
    if (combinatieVelden) {
      combinatieVelden.style.display = data.is_combinatie ? 'block' : 'none';
    }

    itemPopup.style.display = 'flex';
  } catch (err) {
    console.error('Fout bij bewerken:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== ITEM VERWIJDEREN =====
async function verwijderItem(id) {
  if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return;

  try {
    const { error } = await supabase
      .from('stock_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // 🔥 LOG: Item verwijderd
    await logActie('verwijderd', 'stock', id);

    showToast('✅ Item verwijderd!', 'success');
    laadStock();
  } catch (err) {
    console.error('Fout bij verwijderen:', err);
    showToast('❌ Fout: ' + err.message, 'error');
  }
}

// ===== MUTATIE POPUP =====
function toonMutatiePopup(id, code, huidigAantal) {
  // Mutatie popup logica hier...
  // Vergeet niet om logging toe te voegen bij het uitvoeren van een mutatie:
  // await logActie('voorraad aangepast', 'stock', id, code, { type: type, aantal: aantal, reden: reden });
}

// ===== INITIALISATIE =====
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🔄 DOMContentLoaded event triggered');

  const auth = await requireAuth('index.html');
  if (!auth.isAuthenticated) {
    console.warn('⚠️ Niet ingelogd, redirect...');
    return;
  }

  await laadStock();

  if (addItemBtn) {
    addItemBtn.addEventListener('click', () => {
      currentItemId = null;
      popupTitle.textContent = 'Nieuw item';
      setValue('itemCode', '');
      setValue('itemOmschrijving', '');
      setValue('itemAantal', '0');
      setValue('itemMinimum', '5');
      setValue('itemLocatie', '');
      if (combinatieVelden) combinatieVelden.style.display = 'none';
      itemPopup.style.display = 'flex';
    });
  }

  if (saveItemBtn) {
    saveItemBtn.addEventListener('click', saveItem);
  }

  if (closeItemPopup) {
    closeItemPopup.addEventListener('click', () => {
      itemPopup.style.display = 'none';
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', laadStock);
  }

  window.addEventListener('click', (e) => {
    if (e.target === itemPopup) {
      itemPopup.style.display = 'none';
    }
  });

  console.log('✅ Stock pagina geïnitialiseerd!');
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

console.log('✅ stock.js geladen!');