// ============================================================
// REGISTRATIES - Ophaalregistraties pagina (registraties.html)
// ============================================================

console.log('🚀 registraties.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml, formatDate } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let alleRegistraties = [];
let alleAdressen = [];
let alleCombinaties = [];
let currentRegistratieId = null;

// ===== DOM ELEMENTEN =====
const registratiesLijst = document.getElementById('registratiesLijst');
const addRegistratieBtn = document.getElementById('addRegistratieBtn');
const registratiePopup = document.getElementById('registratiePopup');
const saveRegistratieBtn = document.getElementById('saveRegistratieBtn');
const closeRegistratiePopup = document.getElementById('closeRegistratiePopup');
const popupTitle = document.getElementById('popupTitle');
const registratieType = document.getElementById('registratieType');
const ziekenhuisSelect = document.getElementById('ziekenhuisSelect');
const registratieDatum = document.getElementById('registratieDatum');
const gewicht = document.getElementById('gewicht');
const ophalingVeldenReg = document.getElementById('ophalingVeldenReg');
const opstartVelden = document.getElementById('opstartVelden');
const combinatieSelect = document.getElementById('combinatieSelect');
const opstartAantal = document.getElementById('opstartAantal');
const opmerkingenReg = document.getElementById('opmerkingen');
const searchZiekenhuis = document.getElementById('searchZiekenhuis');
const filterDatumVanaf = document.getElementById('filterDatumVanaf');
const filterDatumTot = document.getElementById('filterDatumTot');
const typeFilter = document.getElementById('typeFilter');
const filterBtn = document.getElementById('filterBtn');
const resetFilterBtn = document.getElementById('resetFilterBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const importExcelBtn = document.getElementById('importExcelBtn');
const importPopup = document.getElementById('importPopup');
const fileInput = document.getElementById('fileInput');
const confirmImportBtn = document.getElementById('confirmImportBtn');
const closeImportPopup = document.getElementById('closeImportPopup');
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
const importPreview = document.getElementById('importPreview');

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

// ===== ADRESSEN LADEN =====
async function laadAdressen() {
    try {
        const { data, error } = await supabase
            .from('adressen')
            .select('id, instelling_naam')
            .order('instelling_naam');
        
        if (error) throw error;
        
        alleAdressen = data || [];
        
        // Vul de ziekenhuis select
        const select = document.getElementById('ziekenhuisSelect');
        if (select) {
            select.innerHTML = '<option value="">Kies een ziekenhuis...</option>';
            alleAdressen.forEach(adres => {
                const option = document.createElement('option');
                option.value = adres.id;
                option.textContent = adres.instelling_naam;
                select.appendChild(option);
            });
        }
        console.log('📋 Adressen geladen:', alleAdressen.length);
    } catch (err) {
        console.error('Fout bij laden adressen:', err);
        showToast('Fout bij laden adressen: ' + err.message, 'error');
    }
}

// ===== COMBINATIES LADEN =====
async function laadCombinaties() {
    try {
        const { data, error } = await supabase
            .from('stock_items')
            .select('id, item_code, omschrijving')
            .order('omschrijving');
        
        if (error) throw error;
        
        alleCombinaties = data || [];
        
        // Vul de combinatie select
        const select = document.getElementById('combinatieSelect');
        if (select) {
            select.innerHTML = '<option value="">Kies een combinatie...</option>';
            alleCombinaties.forEach(combinatie => {
                const option = document.createElement('option');
                option.value = combinatie.id;
                option.textContent = `${combinatie.item_code} - ${combinatie.omschrijving}`;
                select.appendChild(option);
            });
        }
        console.log('📋 Combinaties geladen:', alleCombinaties.length);
    } catch (err) {
        console.error('Fout bij laden combinaties:', err);
        showToast('Fout bij laden combinaties: ' + err.message, 'error');
    }
}

// ===== REGISTRATIES LADEN =====
async function laadRegistraties() {
    if (!registratiesLijst) return;
    
    registratiesLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        // Bouw de query
        let query = supabase
            .from('ophaalregistraties')
            .select(`
                *,
                ziekenhuis:ziekenhuis_id (id, instelling_naam),
                combinatie:combinatie_id (id, item_code, omschrijving)
            `)
            .order('registratiedatum', { ascending: false });
        
        // Filters toepassen
        if (filterDatumVanaf && filterDatumVanaf.value) {
            query = query.gte('registratiedatum', filterDatumVanaf.value);
        }
        
        if (filterDatumTot && filterDatumTot.value) {
            query = query.lte('registratiedatum', filterDatumTot.value);
        }
        
        if (typeFilter && typeFilter.value && typeFilter.value !== 'alles') {
            query = query.eq('type', typeFilter.value);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        alleRegistraties = data || [];
        console.log('📋 Registraties geladen:', alleRegistraties.length);
        
        // Filter op ziekenhuis naam (client-side)
        let filteredData = alleRegistraties;
        if (searchZiekenhuis && searchZiekenhuis.value) {
            const term = searchZiekenhuis.value.toLowerCase();
            filteredData = alleRegistraties.filter(reg => 
                reg.ziekenhuis?.instelling_naam?.toLowerCase().includes(term)
            );
        }
        
        toonRegistraties(filteredData);
    } catch (err) {
        console.error('Fout bij laden registraties:', err);
        registratiesLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== REGISTRATIES TONEN =====
function toonRegistraties(registraties) {
    if (!registratiesLijst) return;
    
    if (!registraties || registraties.length === 0) {
        registratiesLijst.innerHTML = '<p>Geen registraties gevonden.</p>';
        return;
    }
    
    let html = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Datum</th>
                        <th>Ziekenhuis</th>
                        <th>Type</th>
                        <th>Gewicht (kg)</th>
                        <th>Combinatie</th>
                        <th>Aantal</th>
                        <th>Opmerkingen</th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    registraties.forEach(reg => {
        const typeLabel = reg.type === 'ophaling' ? '📦 Ophaling' : '🔄 Opstart';
        const gewichtDisplay = reg.gewicht ? `${reg.gewicht} kg` : '-';
        const combinatieDisplay = reg.combinatie ? `${reg.combinatie.item_code} - ${reg.combinatie.omschrijving}` : '-';
        const aantalDisplay = reg.opstart_aantal || '-';
        
        html += `
            <tr>
                <td>${formatDate(reg.registratiedatum)}</td>
                <td><strong>${escapeHtml(reg.ziekenhuis?.instelling_naam || 'Onbekend')}</strong></td>
                <td>${typeLabel}</td>
                <td>${gewichtDisplay}</td>
                <td>${escapeHtml(combinatieDisplay)}</td>
                <td>${aantalDisplay}</td>
                <td>${escapeHtml(reg.opmerkingen || '-')}</td>
                <td>
                    <button class="btn btn-secondary edit-btn" data-id="${reg.id}">✏️</button>
                    <button class="btn btn-danger delete-btn" data-id="${reg.id}">🗑️</button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    registratiesLijst.innerHTML = html;
    console.log('✅ Registraties weergegeven:', registraties.length);
    
    // Event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => bewerkRegistratie(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => verwijderRegistratie(btn.dataset.id));
    });
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
        setValue('combinatieSelect', data.combinatie_id || '');
        setValue('opstartAantal', data.opstart_aantal || 1);
        setValue('opmerkingen', data.opmerkingen || '');
        
        // Toon/verberg velden
        ophalingVeldenReg.style.display = data.type === 'ophaling' ? 'block' : 'none';
        opstartVelden.style.display = data.type === 'opstart' ? 'block' : 'none';
        
        registratiePopup.style.display = 'flex';
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
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
        
        showToast('✅ Registratie verwijderd!', 'success');
        await laadRegistraties();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== REGISTRATIE OPSLAAN =====
async function saveRegistratie() {
    const type = getValue('registratieType');
    const ziekenhuis_id = getValue('ziekenhuisSelect');
    const datum = getValue('registratieDatum');
    const opmerkingen = getValue('opmerkingen');
    
    if (!type || !ziekenhuis_id || !datum) {
        showToast('Vul alle verplichte velden in', 'error');
        return;
    }
    
    const registratieData = {
        type: type,
        ziekenhuis_id: parseInt(ziekenhuis_id),
        registratiedatum: datum,
        opmerkingen: opmerkingen || null
    };
    
    if (type === 'ophaling') {
        registratieData.gewicht = parseFloat(getValue('gewicht')) || null;
        registratieData.combinatie_id = null;
        registratieData.opstart_aantal = null;
    } else if (type === 'opstart') {
        registratieData.combinatie_id = parseInt(getValue('combinatieSelect')) || null;
        registratieData.opstart_aantal = parseInt(getValue('opstartAantal')) || 1;
        registratieData.gewicht = null;
    }
    
    try {
        let result;
        if (currentRegistratieId) {
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
        
        showToast('✅ Registratie opgeslagen!', 'success');
        registratiePopup.style.display = 'none';
        await laadRegistraties();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== FILTER RESET =====
function resetFilters() {
    if (searchZiekenhuis) searchZiekenhuis.value = '';
    if (filterDatumVanaf) filterDatumVanaf.value = '';
    if (filterDatumTot) filterDatumTot.value = '';
    if (typeFilter) typeFilter.value = 'alles';
    laadRegistraties();
}

// ===== EXCEL EXPORT =====
async function exportExcel() {
    if (!alleRegistraties || alleRegistraties.length === 0) {
        showToast('⚠️ Geen data om te exporteren', 'error');
        return;
    }
    
    try {
        showToast('📊 Excel wordt voorbereid...', 'info');
        
        // Bouw de data voor Excel
        const excelData = alleRegistraties.map(reg => ({
            'Datum': formatDate(reg.registratiedatum),
            'Ziekenhuis': reg.ziekenhuis?.instelling_naam || 'Onbekend',
            'Type': reg.type === 'ophaling' ? 'Ophaling' : 'Opstart',
            'Gewicht (kg)': reg.gewicht || '',
            'Combinatie': reg.combinatie ? `${reg.combinatie.item_code} - ${reg.combinatie.omschrijving}` : '',
            'Aantal': reg.opstart_aantal || '',
            'Opmerkingen': reg.opmerkingen || ''
        }));
        
        // Maak een werkboek
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, 'Registraties');
        
        // Genereer bestand
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        // Download
        const link = document.createElement('a');
        link.href = url;
        link.download = `registraties_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('✅ Excel export succesvol!', 'success');
    } catch (err) {
        console.error('Fout bij Excel export:', err);
        showToast('❌ Fout bij Excel export: ' + err.message, 'error');
    }
}

// ===== PDF EXPORT =====
async function exportPdf() {
    if (!alleRegistraties || alleRegistraties.length === 0) {
        showToast('⚠️ Geen data om te exporteren', 'error');
        return;
    }
    
    try {
        showToast('📄 PDF wordt voorbereid...', 'info');
        
        // Bouw HTML voor PDF
        let html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Ophaalregistraties</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #2c7da0; text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                    th { background: #2c7da0; color: white; padding: 8px; text-align: left; }
                    td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
                    .footer { text-align: center; color: #999; margin-top: 30px; font-size: 10px; }
                </style>
            </head>
            <body>
                <h1>📋 Ophaalregistraties</h1>
                <p style="text-align: center; color: #666;">Gegenereerd op ${new Date().toLocaleString('nl-NL')}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Ziekenhuis</th>
                            <th>Type</th>
                            <th>Gewicht (kg)</th>
                            <th>Combinatie</th>
                            <th>Aantal</th>
                            <th>Opmerkingen</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        alleRegistraties.forEach(reg => {
            html += `
                <tr>
                    <td>${formatDate(reg.registratiedatum)}</td>
                    <td>${escapeHtml(reg.ziekenhuis?.instelling_naam || 'Onbekend')}</td>
                    <td>${reg.type === 'ophaling' ? 'Ophaling' : 'Opstart'}</td>
                    <td>${reg.gewicht || '-'}</td>
                    <td>${reg.combinatie ? escapeHtml(reg.combinatie.item_code + ' - ' + reg.combinatie.omschrijving) : '-'}</td>
                    <td>${reg.opstart_aantal || '-'}</td>
                    <td>${escapeHtml(reg.opmerkingen || '-')}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
                <div class="footer">Automatisch gegenereerd - Project</div>
            </body>
            </html>
        `;
        
        // Open print venster
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            showToast('⚠️ Pop-up blocker geblokkeerd', 'error');
            return;
        }
        
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                showToast('✅ PDF geopend voor afdrukken!', 'success');
            }, 500);
        };
    } catch (err) {
        console.error('Fout bij PDF export:', err);
        showToast('❌ Fout bij PDF export: ' + err.message, 'error');
    }
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Registraties pagina initialiseren...');
    
    // Auth check
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    // Laad data
    await laadAdressen();
    await laadCombinaties();
    await laadRegistraties();
    
    // ===== EVENT LISTENERS =====
    
    // Type select toon/verberg velden
    if (registratieType) {
        registratieType.addEventListener('change', function() {
            ophalingVeldenReg.style.display = this.value === 'ophaling' ? 'block' : 'none';
            opstartVelden.style.display = this.value === 'opstart' ? 'block' : 'none';
        });
    }
    
    // Nieuwe registratie knop
    if (addRegistratieBtn) {
        addRegistratieBtn.addEventListener('click', () => {
            currentRegistratieId = null;
            popupTitle.textContent = 'Nieuwe registratie';
            setValue('registratieType', 'ophaling');
            setValue('ziekenhuisSelect', '');
            setValue('registratieDatum', new Date().toISOString().split('T')[0]);
            setValue('gewicht', '');
            setValue('combinatieSelect', '');
            setValue('opstartAantal', '1');
            setValue('opmerkingen', '');
            ophalingVeldenReg.style.display = 'block';
            opstartVelden.style.display = 'none';
            registratiePopup.style.display = 'flex';
        });
    }
    
    // Opslaan knop
    if (saveRegistratieBtn) {
        saveRegistratieBtn.addEventListener('click', saveRegistratie);
    }
    
    // Sluiten popup
    if (closeRegistratiePopup) {
        closeRegistratiePopup.addEventListener('click', () => {
            registratiePopup.style.display = 'none';
        });
    }
    
    // Sluiten bij klik buiten popup
    window.addEventListener('click', (e) => {
        if (e.target === registratiePopup) {
            registratiePopup.style.display = 'none';
        }
    });
    
    // Filter knop
    if (filterBtn) {
        filterBtn.addEventListener('click', laadRegistraties);
    }
    
    // Reset filter knop
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetFilters);
    }
    
    // Excel export
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportExcel);
    }
    
    // PDF export
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportPdf);
    }
    
    console.log('✅ Registraties pagina geïnitialiseerd!');
});

console.log('✅ registraties.js geladen!');