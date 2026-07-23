// ============================================================
// STOCK - Voorraadbeheer pagina (stock.html)
// ============================================================

console.log('🚀 stock.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml, formatDate } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let alleItems = [];
let alleCombinaties = [];
let currentItemId = null;
let currentCombinatieId = null;
let selectedComponents = [];

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

// Item popup
const itemPopup = document.getElementById('itemPopup');
const popupTitle = document.getElementById('popupTitle');
const itemCode = document.getElementById('itemCode');
const itemOmschrijving = document.getElementById('itemOmschrijving');
const itemAantal = document.getElementById('itemAantal');
const itemMinimum = document.getElementById('itemMinimum');
const itemLocatie = document.getElementById('itemLocatie');
const saveItemBtn = document.getElementById('saveItemBtn');
const closeItemPopup = document.getElementById('closeItemPopup');

// Combinatie popup
const combinatiePopup = document.getElementById('combinatiePopup');
const combinatiePopupTitle = document.getElementById('combinatiePopupTitle');
const combinatieCode = document.getElementById('combinatieCode');
const combinatieOmschrijving = document.getElementById('combinatieOmschrijving');
const combinatieLocatie = document.getElementById('combinatieLocatie');
const combinatieId = document.getElementById('combinatieId');
const componentSelect = document.getElementById('componentSelect');
const componentAantal = document.getElementById('componentAantal');
const addComponentBtn = document.getElementById('addComponentBtn');
const componentenLijst = document.getElementById('componentenLijst');
const saveCombinatieBtn = document.getElementById('saveCombinatieBtn');
const closeCombinatiePopup = document.getElementById('closeCombinatiePopup');

// Mutatie popup
const mutatiePopup = document.getElementById('mutatiePopup');
const mutatieTitle = document.getElementById('mutatieTitle');
const mutatieItemName = document.getElementById('mutatieItemName');
const mutatieHuidigAantal = document.getElementById('mutatieHuidigAantal');
const mutatieType = document.getElementById('mutatieType');
const mutatieAantal = document.getElementById('mutatieAantal');
const mutatieAantalDiv = document.getElementById('mutatieAantalDiv');
const mutatieCorrectieDiv = document.getElementById('mutatieCorrectieDiv');
const mutatieCorrectieAantal = document.getElementById('mutatieCorrectieAantal');
const mutatieReden = document.getElementById('mutatieReden');
const saveMutatieBtn = document.getElementById('saveMutatieBtn');
const closeMutatiePopup = document.getElementById('closeMutatiePopup');

console.log('✅ DOM elementen gevonden');

// ===== HULPFUNCTIES =====
function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

// ===== STOCK ITEMS LADEN =====
async function laadStockItems() {
    if (!stockLijst) return;
    
    stockLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        // Haal alle items op (incl. combinatie status)
        const { data: items, error: itemsError } = await supabase
            .from('stock_items')
            .select('*')
            .order('item_code');
        
        if (itemsError) throw itemsError;
        
        // Haal alle combinaties op
        const { data: combinaties, error: combError } = await supabase
            .from('stock_items')
            .select('*')
            .eq('is_combinatie', true)
            .order('item_code');
        
        if (combError) throw combError;
        
        // Haal componenten voor combinaties
        const { data: components, error: compError } = await supabase
            .from('combinatie_componenten')
            .select('*');
        
        if (compError) throw compError;
        
        alleItems = items || [];
        alleCombinaties = combinaties || [];
        
        // Voeg component info toe aan combinaties
        const componentMap = {};
        components.forEach(c => {
            if (!componentMap[c.combinatie_id]) {
                componentMap[c.combinatie_id] = [];
            }
            componentMap[c.combinatie_id].push(c);
        });
        
        alleCombinaties.forEach(comb => {
            comb.componenten = componentMap[comb.id] || [];
        });
        
        toonStockItems(alleItems);
    } catch (err) {
        console.error('Fout bij laden stock items:', err);
        stockLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== STOCK ITEMS TONEN =====
function toonStockItems(items) {
    if (!stockLijst) return;
    
    // Filters toepassen
    let filteredData = items;
    
    // Zoekfilter
    if (searchStock && searchStock.value) {
        const term = searchStock.value.toLowerCase();
        filteredData = filteredData.filter(item => 
            (item.item_code && item.item_code.toLowerCase().includes(term)) ||
            (item.omschrijving && item.omschrijving.toLowerCase().includes(term))
        );
    }
    
    // Type filter
    if (typeFilter && typeFilter.value && typeFilter.value !== 'alles') {
        if (typeFilter.value === 'enkel') {
            filteredData = filteredData.filter(item => !item.is_combinatie);
        } else if (typeFilter.value === 'combinatie') {
            filteredData = filteredData.filter(item => item.is_combinatie);
        }
    }
    
    // Status filter
    if (statusFilter && statusFilter.value && statusFilter.value !== 'alles') {
        if (statusFilter.value === 'voorraad') {
            filteredData = filteredData.filter(item => item.aantal > item.minimum_stock);
        } else if (statusFilter.value === 'laag') {
            filteredData = filteredData.filter(item => item.aantal <= item.minimum_stock && item.aantal > 0);
        } else if (statusFilter.value === 'op') {
            filteredData = filteredData.filter(item => item.aantal === 0);
        }
    }
    
    if (!filteredData || filteredData.length === 0) {
        stockLijst.innerHTML = '<p>Geen items gevonden.</p>';
        return;
    }
    
    let html = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Omschrijving</th>
                        <th>Type</th>
                        <th>Aantal</th>
                        <th>Minimum</th>
                        <th>Status</th>
                        <th>Locatie</th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    filteredData.forEach(item => {
        const isCombinatie = item.is_combinatie || false;
        const typeLabel = isCombinatie ? '📦 Combinatie' : '📦 Item';
        const statusClass = item.aantal === 0 ? 'status-op' : 
                          (item.aantal <= item.minimum_stock ? 'status-laag' : 'status-voldoende');
        const statusLabel = item.aantal === 0 ? 'Op' : 
                          (item.aantal <= item.minimum_stock ? 'Laag' : 'Voldoende');
        
        html += `
            <tr>
                <td><strong>${escapeHtml(item.item_code)}</strong></td>
                <td>${escapeHtml(item.omschrijving)}</td>
                <td>${typeLabel}</td>
                <td>${item.aantal}</td>
                <td>${item.minimum_stock}</td>
                <td><span class="stock-status ${statusClass}">${statusLabel}</span></td>
                <td>${escapeHtml(item.locatie || '-')}</td>
                <td>
                    <button class="btn btn-secondary mutatie-btn" data-id="${item.id}" title="Voorraad aanpassen">📦</button>
                    ${!isCombinatie ? `<button class="btn btn-secondary edit-item-btn" data-id="${item.id}">✏️</button>` : 
                                     `<button class="btn btn-secondary edit-combinatie-btn" data-id="${item.id}">✏️</button>`}
                    <button class="btn btn-danger delete-btn" data-id="${item.id}">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    stockLijst.innerHTML = html;
    
    // Event listeners
    document.querySelectorAll('.mutatie-btn').forEach(btn => {
        btn.addEventListener('click', () => openMutatiePopup(btn.dataset.id));
    });
    
    document.querySelectorAll('.edit-item-btn').forEach(btn => {
        btn.addEventListener('click', () => bewerkItem(btn.dataset.id));
    });
    
    document.querySelectorAll('.edit-combinatie-btn').forEach(btn => {
        btn.addEventListener('click', () => bewerkCombinatie(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => verwijderItem(btn.dataset.id));
    });
}

// ===== ITEM FUNCTIES =====

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
        
        // Verberg combinatie specifieke velden
        document.querySelector('.combinatie-velden').style.display = 'none';
        
        itemPopup.style.display = 'flex';
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

async function verwijderItem(id) {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return;
    
    try {
        const { error } = await supabase
            .from('stock_items')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('✅ Item verwijderd!', 'success');
        await laadStockItems();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

async function saveItem() {
    const code = getValue('itemCode');
    const omschrijving = getValue('itemOmschrijving');
    const aantal = parseInt(getValue('itemAantal')) || 0;
    const minimum = parseInt(getValue('itemMinimum')) || 5;
    const locatie = getValue('itemLocatie') || null;
    
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
        is_combinatie: false
    };
    
    try {
        let result;
        if (currentItemId) {
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
        
        showToast('✅ Item opgeslagen!', 'success');
        itemPopup.style.display = 'none';
        await laadStockItems();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== COMBINATIE FUNCTIES =====

async function bewerkCombinatie(id) {
    try {
        const { data, error } = await supabase
            .from('stock_items')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        // Haal componenten op
        const { data: components, error: compError } = await supabase
            .from('combinatie_componenten')
            .select('*, component:component_id (id, item_code, omschrijving)')
            .eq('combinatie_id', id);
        
        if (compError) throw compError;
        
        currentCombinatieId = id;
        combinatiePopupTitle.textContent = 'Combinatie bewerken';
        setValue('combinatieCode', data.item_code);
        setValue('combinatieOmschrijving', data.omschrijving);
        setValue('combinatieLocatie', data.locatie || '');
        setValue('combinatieId', id);
        
        selectedComponents = components || [];
        toonComponenten();
        laadComponentenSelect();
        
        combinatiePopup.style.display = 'flex';
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

async function saveCombinatie() {
    const code = getValue('combinatieCode');
    const omschrijving = getValue('combinatieOmschrijving');
    const locatie = getValue('combinatieLocatie') || null;
    
    if (!code || !omschrijving) {
        showToast('Vul code en omschrijving in', 'error');
        return;
    }
    
    const combinatieData = {
        item_code: code,
        omschrijving: omschrijving,
        aantal: 0, // Combinaties hebben geen eigen voorraad
        minimum_stock: 0,
        locatie: locatie,
        is_combinatie: true
    };
    
    try {
        let result;
        let combinatieId;
        
        if (currentCombinatieId) {
            result = await supabase
                .from('stock_items')
                .update(combinatieData)
                .eq('id', currentCombinatieId);
            combinatieId = currentCombinatieId;
        } else {
            result = await supabase
                .from('stock_items')
                .insert([combinatieData])
                .select();
            combinatieId = result.data?.[0]?.id;
        }
        
        if (result.error) throw result.error;
        
        // Sla componenten op
        if (combinatieId) {
            // Verwijder oude componenten
            await supabase
                .from('combinatie_componenten')
                .delete()
                .eq('combinatie_id', combinatieId);
            
            // Voeg nieuwe componenten toe
            for (const comp of selectedComponents) {
                await supabase
                    .from('combinatie_componenten')
                    .insert([{
                        combinatie_id: combinatieId,
                        component_id: comp.component_id,
                        aantal: comp.aantal
                    }]);
            }
        }
        
        showToast('✅ Combinatie opgeslagen!', 'success');
        combinatiePopup.style.display = 'none';
        await laadStockItems();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

function toonComponenten() {
    if (!componentenLijst) return;
    
    if (!selectedComponents || selectedComponents.length === 0) {
        componentenLijst.innerHTML = '<p>Geen componenten toegevoegd.</p>';
        return;
    }
    
    let html = '';
    selectedComponents.forEach((comp, index) => {
        const naam = comp.component?.omschrijving || comp.omschrijving || 'Onbekend';
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8f9fa; border-radius: 4px; margin-bottom: 4px;">
                <span>${escapeHtml(naam)} × ${comp.aantal}</span>
                <button class="btn btn-danger btn-small remove-component-btn" data-index="${index}">✖</button>
            </div>
        `;
    });
    
    componentenLijst.innerHTML = html;
    
    document.querySelectorAll('.remove-component-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            selectedComponents.splice(index, 1);
            toonComponenten();
        });
    });
}

async function laadComponentenSelect() {
    if (!componentSelect) return;
    
    try {
        const { data, error } = await supabase
            .from('stock_items')
            .select('id, item_code, omschrijving')
            .eq('is_combinatie', false)
            .order('item_code');
        
        if (error) throw error;
        
        const items = data || [];
        componentSelect.innerHTML = '<option value="">Kies een component...</option>';
        items.forEach(item => {
            // Controleer of dit item al geselecteerd is
            const isSelected = selectedComponents.some(c => c.component_id === item.id);
            if (!isSelected) {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.item_code} - ${item.omschrijving}`;
                componentSelect.appendChild(option);
            }
        });
    } catch (err) {
        console.error('Fout bij laden componenten select:', err);
    }
}

// ===== MUTATIE FUNCTIES =====

async function openMutatiePopup(itemId) {
    try {
        const { data, error } = await supabase
            .from('stock_items')
            .select('*')
            .eq('id', itemId)
            .single();
        
        if (error) throw error;
        
        currentItemId = itemId;
        mutatieTitle.textContent = 'Voorraad aanpassen';
        mutatieItemName.textContent = `${data.item_code} - ${data.omschrijving}`;
        mutatieHuidigAantal.textContent = data.aantal;
        
        setValue('mutatieType', 'toevoeging');
        setValue('mutatieAantal', '1');
        setValue('mutatieCorrectieAantal', data.aantal);
        setValue('mutatieReden', '');
        
        mutatieAantalDiv.style.display = 'block';
        mutatieCorrectieDiv.style.display = 'none';
        
        mutatiePopup.style.display = 'flex';
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

async function saveMutatie() {
    const type = getValue('mutatieType');
    const reden = getValue('mutatieReden');
    
    if (!type) {
        showToast('Selecteer een type', 'error');
        return;
    }
    
    let aantal = 0;
    if (type === 'correctie') {
        aantal = parseInt(getValue('mutatieCorrectieAantal')) || 0;
    } else {
        aantal = parseInt(getValue('mutatieAantal')) || 1;
    }
    
    if (aantal <= 0) {
        showToast('Voer een geldig aantal in', 'error');
        return;
    }
    
    try {
        // Haal huidig item op
        const { data: item, error: itemError } = await supabase
            .from('stock_items')
            .select('aantal')
            .eq('id', currentItemId)
            .single();
        
        if (itemError) throw itemError;
        
        let nieuwAantal = item.aantal;
        if (type === 'toevoeging') {
            nieuwAantal = item.aantal + aantal;
        } else if (type === 'afname') {
            nieuwAantal = Math.max(0, item.aantal - aantal);
        } else if (type === 'correctie') {
            nieuwAantal = aantal;
        }
        
        // Update voorraad
        const { error: updateError } = await supabase
            .from('stock_items')
            .update({ aantal: nieuwAantal })
            .eq('id', currentItemId);
        
        if (updateError) throw updateError;
        
        // Log mutatie
        await supabase
            .from('stock_mutaties')
            .insert([{
                item_id: currentItemId,
                type: type,
                aantal: type === 'correctie' ? nieuwAantal - item.aantal : (type === 'toevoeging' ? aantal : -aantal),
                reden: reden || null
            }]);
        
        showToast('✅ Voorraad bijgewerkt!', 'success');
        mutatiePopup.style.display = 'none';
        await laadStockItems();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== FILTER RESET =====
function resetFilters() {
    if (searchStock) searchStock.value = '';
    if (typeFilter) typeFilter.value = 'alles';
    if (statusFilter) statusFilter.value = 'alles';
    laadStockItems();
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Stock pagina initialiseren...');
    
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    await laadStockItems();
    
    // ===== EVENT LISTENERS =====
    
    // Nieuwe item knop
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            currentItemId = null;
            popupTitle.textContent = 'Nieuw item';
            setValue('itemCode', '');
            setValue('itemOmschrijving', '');
            setValue('itemAantal', '0');
            setValue('itemMinimum', '5');
            setValue('itemLocatie', '');
            document.querySelector('.combinatie-velden').style.display = 'none';
            itemPopup.style.display = 'flex';
        });
    }
    
    // Nieuwe combinatie knop
    if (addCombinatieBtn) {
        addCombinatieBtn.addEventListener('click', () => {
            currentCombinatieId = null;
            combinatiePopupTitle.textContent = 'Nieuwe combinatie';
            setValue('combinatieCode', '');
            setValue('combinatieOmschrijving', '');
            setValue('combinatieLocatie', '');
            setValue('combinatieId', '');
            selectedComponents = [];
            toonComponenten();
            laadComponentenSelect();
            combinatiePopup.style.display = 'flex';
        });
    }
    
    // Refresh knop
    if (refreshBtn) {
        refreshBtn.addEventListener('click', laadStockItems);
    }
    
    // Item opslaan
    if (saveItemBtn) {
        saveItemBtn.addEventListener('click', saveItem);
    }
    
    // Combinatie opslaan
    if (saveCombinatieBtn) {
        saveCombinatieBtn.addEventListener('click', saveCombinatie);
    }
    
    // Component toevoegen
    if (addComponentBtn && componentSelect) {
        addComponentBtn.addEventListener('click', () => {
            const componentId = parseInt(componentSelect.value);
            const aantal = parseInt(componentAantal?.value) || 1;
            
            if (!componentId) {
                showToast('Kies een component', 'error');
                return;
            }
            
            // Voeg component toe
            selectedComponents.push({
                component_id: componentId,
                aantal: aantal,
                omschrijving: componentSelect.options[componentSelect.selectedIndex]?.text || 'Onbekend'
            });
            
            toonComponenten();
            laadComponentenSelect();
            if (componentAantal) componentAantal.value = '1';
        });
    }
    
    // Mutatie type verandering
    if (mutatieType) {
        mutatieType.addEventListener('change', function() {
            if (this.value === 'correctie') {
                mutatieAantalDiv.style.display = 'none';
                mutatieCorrectieDiv.style.display = 'block';
            } else {
                mutatieAantalDiv.style.display = 'block';
                mutatieCorrectieDiv.style.display = 'none';
            }
        });
    }
    
    // Mutatie opslaan
    if (saveMutatieBtn) {
        saveMutatieBtn.addEventListener('click', saveMutatie);
    }
    
    // Sluiten popups
    if (closeItemPopup) {
        closeItemPopup.addEventListener('click', () => {
            itemPopup.style.display = 'none';
        });
    }
    
    if (closeCombinatiePopup) {
        closeCombinatiePopup.addEventListener('click', () => {
            combinatiePopup.style.display = 'none';
        });
    }
    
    if (closeMutatiePopup) {
        closeMutatiePopup.addEventListener('click', () => {
            mutatiePopup.style.display = 'none';
        });
    }
    
    // Sluiten bij klik buiten popup
    window.addEventListener('click', (e) => {
        if (e.target === itemPopup) {
            itemPopup.style.display = 'none';
        }
        if (e.target === combinatiePopup) {
            combinatiePopup.style.display = 'none';
        }
        if (e.target === mutatiePopup) {
            mutatiePopup.style.display = 'none';
        }
    });
    
    // Filters
    if (filterBtn) {
        filterBtn.addEventListener('click', laadStockItems);
    }
    
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetFilters);
    }
    
    // Enter-toets op zoekveld
    if (searchStock) {
        searchStock.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filterBtn) filterBtn.click();
            }
        });
    }
    
    console.log('✅ Stock pagina geïnitialiseerd!');
});

console.log('✅ stock.js geladen!');