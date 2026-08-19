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

// ===== COMBINATIES LADEN (ALLEEN ECHTE COMBINATIES) =====
async function laadCombinaties() {
    try {
        // Haal alle items op die een combinatie zijn
        // Een item is een combinatie als het voorkomt in combinatie_componenten als combinatie_id
        const { data: combinatieIds, error: idsError } = await supabase
            .from('combinatie_componenten')
            .select('combinatie_id');
        
        if (idsError) throw idsError;
        
        // Verzamel unieke combinatie IDs
        const uniqueIds = [...new Set(combinatieIds.map(c => c.combinatie_id))];
        
        if (uniqueIds.length === 0) {
            // Geen combinaties gevonden
            const select = document.getElementById('combinatieSelect');
            if (select) {
                select.innerHTML = '<option value="">Geen combinaties beschikbaar</option>';
            }
            console.log('📋 Geen combinaties gevonden');
            return;
        }
        
        // Haal de details van deze combinaties op
        const { data: combinaties, error: combError } = await supabase
            .from('stock_items')
            .select('id, item_code, omschrijving')
            .in('id', uniqueIds)
            .order('item_code');
        
        if (combError) throw combError;
        
        alleCombinaties = combinaties || [];
        
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
        let query = supabase
            .from('ophaalregistraties')
            .select(`
                *,
                ziekenhuis:ziekenhuis_id (id, instelling_naam),
                combinatie:combinatie_id (id, item_code, omschrijving)
            `)
            .order('registratiedatum', { ascending: false });
        
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
        
        toonRegistraties(alleRegistraties);
    } catch (err) {
        console.error('Fout bij laden registraties:', err);
        registratiesLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== REGISTRATIES TONEN (MET SUMMARY) =====
function toonRegistraties(registraties) {
    if (!registratiesLijst) return;
    
    // Pas client-side filtering toe voor de weergave
    let filteredData = registraties;
    if (searchZiekenhuis && searchZiekenhuis.value) {
        const term = searchZiekenhuis.value.toLowerCase();
        filteredData = registraties.filter(reg => 
            reg.ziekenhuis?.instelling_naam?.toLowerCase().includes(term)
        );
    }
    
    // ===== BEREKEN SUMMARY =====
    const ophalingen = filteredData.filter(reg => reg.type === 'ophaling');
    const opstarten = filteredData.filter(reg => reg.type === 'opstart');
    
    const totaalAantal = filteredData.length;
    const totaalOphalingen = ophalingen.length;
    const totaalOpstarten = opstarten.length;
    const totaalGewicht = ophalingen.reduce((sum, reg) => sum + (reg.gewicht || 0), 0);
    const gemiddeldGewicht = totaalOphalingen > 0 ? totaalGewicht / totaalOphalingen : 0;
    
    // ===== SUMMARY HTML =====
    let summaryHtml = '';
    if (filteredData.length > 0) {
        summaryHtml = `
            <div class="registratie-summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">📋 Totaal registraties</span>
                        <span class="summary-value">${totaalAantal}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">📦 Ophalingen</span>
                        <span class="summary-value">${totaalOphalingen}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">⚖️ Totaal gewicht</span>
                        <span class="summary-value">${totaalGewicht.toFixed(1)} kg</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">📊 Gemiddeld gewicht</span>
                        <span class="summary-value">${gemiddeldGewicht.toFixed(1)} kg</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">🔄 Opstarten</span>
                        <span class="summary-value">${totaalOpstarten}</span>
                    </div>
                </div>
                ${searchZiekenhuis?.value || filterDatumVanaf?.value || filterDatumTot?.value || (typeFilter?.value && typeFilter.value !== 'alles') ? `
                    <div class="summary-filter-info">
                        🔍 Gefilterd: ${filteredData.length} van ${registraties.length} registraties
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // ===== TABEL HTML =====
    let tabelHtml = '';
    if (!filteredData || filteredData.length === 0) {
        tabelHtml = '<p>Geen registraties gevonden.</p>';
    } else {
        tabelHtml = `
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
        
        filteredData.forEach(reg => {
            const typeLabel = reg.type === 'ophaling' ? '📦 Ophaling' : '🔄 Opstart';
            const gewichtDisplay = reg.gewicht ? `${reg.gewicht} kg` : '-';
            
            // ===== COMBINATIE WEERGAVE (MET ALLE COMBINATIES) =====
            let combinatieDisplay = '-';
            if (reg.combinatie_lijst && reg.combinatie_lijst.length > 0) {
                // Toon alle combinaties uit de lijst
                const namen = reg.combinatie_lijst.map(combo => {
                    const combinatie = alleCombinaties.find(c => c.id === combo.combinatie_id);
                    return combinatie ? `${combinatie.item_code}×${combo.aantal}` : `ID ${combo.combinatie_id}×${combo.aantal}`;
                });
                combinatieDisplay = namen.join(', ');
            } else if (reg.combinatie) {
                // Fallback: toon de enkele combinatie
                combinatieDisplay = `${reg.combinatie.item_code} - ${reg.combinatie.omschrijving}`;
            }
            
            const aantalDisplay = reg.opstart_aantal || '-';
            
            tabelHtml += `
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
        
        tabelHtml += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // ===== COMBINEER TABEL + SUMMARY =====
    registratiesLijst.innerHTML = `
        ${tabelHtml}
        ${summaryHtml}
    `;
    
    console.log('✅ Registraties weergegeven:', filteredData.length);
    
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

// ===== REGISTRATIE OPSLAAN (MET STATUS CHECK) =====
async function saveRegistratie() {
    const type = getValue('registratieType');
    const ziekenhuis_id = getValue('ziekenhuisSelect');
    const datum = getValue('registratieDatum');
    const opmerkingen = getValue('opmerkingen');
    
    if (!type || !ziekenhuis_id || !datum) {
        showToast('Vul alle verplichte velden in', 'error');
        return;
    }
    
    // ===== CHECK: Bestaat er een planning voor deze datum? =====
    const { data: planningen, error: planningError } = await supabase
        .from('planningen')
        .select('id, status, type')
        .eq('adres_id', parseInt(ziekenhuis_id))
        .eq('datum', datum);
    
    if (planningError) {
        console.error('Fout bij checken planning:', planningError);
    } else if (planningen && planningen.length > 0) {
        // Er is minstens één planning voor deze datum
        for (const planning of planningen) {
            // Alleen checken voor hetzelfde type (ophaling vs plaatsing)
            const planningType = planning.type === 'ophaling' ? 'ophaling' : 'opstart';
            if (planningType === type && planning.status !== 'uitgevoerd') {
                // Toon een popup met de melding
                const confirmResult = confirm(
                    `⚠️ Er is een ${planning.type === 'ophaling' ? 'ophaling' : 'plaatsing'} gepland voor ${datum} bij dit ziekenhuis.\n\n` +
                    `Status: ${planning.status}\n\n` +
                    'Wil je doorgaan met de registratie zonder de status te wijzigen?'
                );
                
                if (!confirmResult) {
                    return; // Stop met opslaan
                }
                break; // Een melding is voldoende
            }
        }
    }
    
    // ===== REST VAN DE REGISTRATIE LOGICA =====
    const registratieData = {
        type: type,
        ziekenhuis_id: parseInt(ziekenhuis_id),
        registratiedatum: datum,
        opmerkingen: opmerkingen || null
    };
    
    let combinatieId = null;
    let opstartAantal = 1;
    let combinatieLijst = [];
    
    if (type === 'ophaling') {
        registratieData.gewicht = parseFloat(getValue('gewicht')) || null;
        registratieData.combinatie_id = null;
        registratieData.opstart_aantal = null;
        registratieData.combinatie_lijst = [];
    } else if (type === 'opstart') {
        combinatieId = parseInt(getValue('combinatieSelect')) || null;
        opstartAantal = parseInt(getValue('opstartAantal')) || 1;
        registratieData.combinatie_id = combinatieId;
        registratieData.opstart_aantal = opstartAantal;
        registratieData.gewicht = null;
        
        // Als er een combinatie is geselecteerd, voeg deze toe aan de lijst
        if (combinatieId) {
            combinatieLijst = [{
                combinatie_id: combinatieId,
                aantal: opstartAantal
            }];
        }
        registratieData.combinatie_lijst = combinatieLijst;
        
        // Check voorraad beschikbaar
        if (combinatieId) {
            const { data: componenten, error: checkError } = await supabase
                .from('combinatie_componenten')
                .select('*, component:component_id (id, item_code, omschrijving, aantal)')
                .eq('combinatie_id', combinatieId);
            
            if (!checkError && componenten && componenten.length > 0) {
                let tekort = [];
                for (const comp of componenten) {
                    const nodig = comp.aantal * opstartAantal;
                    const beschikbaar = comp.component?.aantal || 0;
                    if (beschikbaar < nodig) {
                        tekort.push({
                            naam: comp.component?.omschrijving || 'Onbekend',
                            nodig: nodig,
                            beschikbaar: beschikbaar
                        });
                    }
                }
                if (tekort.length > 0) {
                    let msg = '⚠️ Niet genoeg voorraad voor deze opstart:\n\n';
                    tekort.forEach(t => {
                        msg += `- ${t.naam}: ${t.nodig} nodig, ${t.beschikbaar} beschikbaar\n`;
                    });
                    msg += '\nWil je doorgaan? (De voorraad wordt dan op 0 gezet)';
                    if (!confirm(msg)) {
                        return;
                    }
                }
            }
        }
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
        
        // ===== VOORRAAD UPDATE BIJ OPSTART =====
        if (type === 'opstart' && combinatieId) {
            const { data: componenten, error: compError } = await supabase
                .from('combinatie_componenten')
                .select('*')
                .eq('combinatie_id', combinatieId);
            
            if (compError) throw compError;
            
            if (componenten && componenten.length > 0) {
                let updatedCount = 0;
                for (const comp of componenten) {
                    const { data: item, error: itemError } = await supabase
                        .from('stock_items')
                        .select('aantal')
                        .eq('id', comp.component_id)
                        .single();
                    
                    if (itemError) throw itemError;
                    
                    const teVerwijderen = comp.aantal * opstartAantal;
                    const nieuwAantal = Math.max(0, item.aantal - teVerwijderen);
                    
                    await supabase
                        .from('stock_items')
                        .update({ aantal: nieuwAantal })
                        .eq('id', comp.component_id);
                    
                    await supabase
                        .from('stock_mutaties')
                        .insert([{
                            item_id: comp.component_id,
                            type: 'afname',
                            aantal: -teVerwijderen,
                            reden: `Opstart combinatie ${combinatieId} - ${opstartAantal}x`
                        }]);
                    
                    updatedCount++;
                }
                
                showToast(`✅ Voorraad bijgewerkt: ${updatedCount} componenten verminderd!`, 'success');
            }
        }
        
        showToast('✅ Registratie opgeslagen!', 'success');
        registratiePopup.style.display = 'none';
        await laadRegistraties();
    } catch (err) {
        console.error('Fout bij opslaan registratie:', err);
        showToast('❌ Fout bij opslaan registratie: ' + err.message, 'error');
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

// ===== EXCEL EXPORT (MET FILTERS EN BEVROZEN RIJ - FALLBACK) =====
async function exportExcel() {
    const huidigeData = getHuidigeGefilterdeData();
    
    if (!huidigeData || huidigeData.length === 0) {
        showToast('⚠️ Geen data om te exporteren (filter is leeg)', 'error');
        return;
    }
    
    try {
        showToast(`📊 ${huidigeData.length} registraties worden geëxporteerd...`, 'info');
        
        const excelData = huidigeData.map(reg => {
            let combinatieDisplay = '';
            if (reg.combinatie_lijst && reg.combinatie_lijst.length > 0) {
                const namen = reg.combinatie_lijst.map(combo => {
                    const combinatie = alleCombinaties.find(c => c.id === combo.combinatie_id);
                    return combinatie ? `${combinatie.item_code}×${combo.aantal}` : `ID ${combo.combinatie_id}×${combo.aantal}`;
                });
                combinatieDisplay = namen.join(', ');
            } else if (reg.combinatie) {
                combinatieDisplay = `${reg.combinatie.item_code} - ${reg.combinatie.omschrijving}`;
            }
            
            return {
                'Datum': formatDate(reg.registratiedatum),
                'Ziekenhuis': reg.ziekenhuis?.instelling_naam || 'Onbekend',
                'Type': reg.type === 'ophaling' ? 'Ophaling' : 'Opstart',
                'Gewicht (kg)': reg.gewicht || '',
                'Combinatie': combinatieDisplay,
                'Aantal': reg.opstart_aantal || '',
                'Opmerkingen': reg.opmerkingen || ''
            };
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // ===== KOLOMBREEDTES =====
        ws['!cols'] = [
            { wch: 15 },  // Datum
            { wch: 35 },  // Ziekenhuis
            { wch: 12 },  // Type
            { wch: 15 },  // Gewicht
            { wch: 45 },  // Combinatie
            { wch: 12 },  // Aantal
            { wch: 35 }   // Opmerkingen
        ];
        
        // ===== BEVROZEN RIJ (EERSTE RIJ) =====
        try {
            ws['!freeze'] = 'A2';
        } catch (e) {
            console.warn('⚠️ Bevroren rij niet ondersteund in deze versie');
        }
        
        XLSX.utils.book_append_sheet(wb, ws, 'Registraties');
        
        const wbout = XLSX.write(wb, { 
            bookType: 'xlsx', 
            type: 'array',
            bookSST: false
        });
        
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `registraties_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast(`✅ ${excelData.length} registraties geëxporteerd!`, 'success');
    } catch (err) {
        console.error('Fout bij Excel export:', err);
        showToast('❌ Fout bij Excel export: ' + err.message, 'error');
    }
}

// ===== PDF EXPORT =====
async function exportPdf() {
    const huidigeData = getHuidigeGefilterdeData();
    
    if (!huidigeData || huidigeData.length === 0) {
        showToast('⚠️ Geen data om te exporteren (filter is leeg)', 'error');
        return;
    }
    
    try {
        showToast(`📄 ${huidigeData.length} registraties worden geëxporteerd...`, 'info');
        
        let html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Ophaalregistraties</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #2c7da0; text-align: center; font-size: 20px; }
                    .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
                    .filter-info { background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 11px; color: #495057; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
                    th { background: #2c7da0; color: white; padding: 6px 8px; text-align: left; }
                    td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
                    .footer { text-align: center; color: #999; margin-top: 20px; font-size: 9px; }
                    .count { font-weight: bold; color: #2c7da0; }
                </style>
            </head>
            <body>
                <h1>📋 Ophaalregistraties</h1>
                <p class="subtitle">Gegenereerd op ${new Date().toLocaleString('nl-NL')}</p>
                <div class="filter-info">
                    <span>📊 Aantal registraties: <span class="count">${huidigeData.length}</span></span>
                    ${searchZiekenhuis?.value ? ` | 🔍 Ziekenhuis: ${searchZiekenhuis.value}` : ''}
                    ${filterDatumVanaf?.value ? ` | 📅 Vanaf: ${filterDatumVanaf.value}` : ''}
                    ${filterDatumTot?.value ? ` | 📅 Tot: ${filterDatumTot.value}` : ''}
                    ${typeFilter?.value && typeFilter.value !== 'alles' ? ` | 📋 Type: ${typeFilter.value === 'ophaling' ? 'Ophaling' : 'Opstart'}` : ''}
                </div>
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
        
        huidigeData.forEach(reg => {
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
                showToast(`✅ ${huidigeData.length} registraties geëxporteerd!`, 'success');
            }, 500);
        };
    } catch (err) {
        console.error('Fout bij PDF export:', err);
        showToast('❌ Fout bij PDF export: ' + err.message, 'error');
    }
}

// ===== HULPFUNCTIE: Huidige gefilterde data =====
function getHuidigeGefilterdeData() {
    let filteredData = alleRegistraties;
    
    if (searchZiekenhuis && searchZiekenhuis.value) {
        const term = searchZiekenhuis.value.toLowerCase();
        filteredData = filteredData.filter(reg => 
            reg.ziekenhuis?.instelling_naam?.toLowerCase().includes(term)
        );
    }
    
    return filteredData;
}

// ===== EXCEL IMPORT =====
function openImportPopup() {
    if (importPopup) {
        importPopup.style.display = 'flex';
        if (importPreview) importPreview.innerHTML = '';
        if (fileInput) fileInput.value = '';
    }
}

function closeImportPopupFunc() {
    if (importPopup) importPopup.style.display = 'none';
}

function downloadTemplate() {
    const templateData = [
        {
            'Ziekenhuis': 'Ziekenhuis A',
            'Datum': '2024-01-01',
            'Gewicht': '15.5',
            'Type': 'ophaling',
            'Opmerkingen': 'Voorbeeld ophaling'
        },
        {
            'Ziekenhuis': 'Ziekenhuis B',
            'Datum': '2024-01-02',
            'Gewicht': '',
            'Type': 'opstart',
            'Opmerkingen': 'Voorbeeld opstart'
        }
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'registraties_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('✅ Template gedownload!', 'success');
}

// ===== SCROLL KNOMMEN =====
function initScrollButtons() {
    const scrollBtn = document.getElementById('scrollBtn');
    if (!scrollBtn) return;
    
    let isScrolling = false;
    let scrollTimeout = null;
    
    function updateScrollButton() {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const maxScroll = documentHeight - windowHeight;
        
        if (maxScroll <= 100) {
            scrollBtn.style.display = 'none';
            return;
        }
        
        scrollBtn.style.display = 'flex';
        
        if (scrollY < 100) {
            scrollBtn.className = 'scroll-btn scroll-down';
            scrollBtn.innerHTML = '<span class="scroll-icon">▼</span>';
            scrollBtn.title = 'Scroll naar beneden';
        } else if (scrollY > maxScroll - 100) {
            scrollBtn.className = 'scroll-btn scroll-up';
            scrollBtn.innerHTML = '<span class="scroll-icon">▲</span>';
            scrollBtn.title = 'Scroll naar boven';
        } else {
            scrollBtn.className = 'scroll-btn scroll-both';
            scrollBtn.innerHTML = '<span class="scroll-icon">▲▼</span>';
            scrollBtn.title = 'Scroll naar boven of beneden';
        }
    }
    
    function handleScrollClick() {
        if (isScrolling) return;
        isScrolling = true;
        
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const maxScroll = documentHeight - windowHeight;
        
        let targetY;
        const isAtTop = scrollY < 100;
        const isAtBottom = scrollY > maxScroll - 100;
        
        if (isAtTop) {
            targetY = maxScroll;
        } else if (isAtBottom) {
            targetY = 0;
        } else {
            const distanceToTop = scrollY;
            const distanceToBottom = maxScroll - scrollY;
            if (distanceToTop < distanceToBottom) {
                targetY = 0;
            } else {
                targetY = maxScroll;
            }
        }
        
        window.scrollTo({
            top: targetY,
            behavior: 'smooth'
        });
        
        setTimeout(() => {
            isScrolling = false;
        }, 1000);
    }
    
    scrollBtn.addEventListener('click', handleScrollClick);
    
    window.addEventListener('scroll', function() {
        if (scrollTimeout) {
            cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = requestAnimationFrame(updateScrollButton);
    });
    
    window.addEventListener('resize', function() {
        if (scrollTimeout) {
            cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = requestAnimationFrame(updateScrollButton);
    });
    
    setTimeout(updateScrollButton, 500);
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Registraties pagina initialiseren...');
    
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    await laadAdressen();
    await laadCombinaties();
    await laadRegistraties();
    
    // ===== EVENT LISTENERS =====
    
    if (registratieType) {
        registratieType.addEventListener('change', function() {
            ophalingVeldenReg.style.display = this.value === 'ophaling' ? 'block' : 'none';
            opstartVelden.style.display = this.value === 'opstart' ? 'block' : 'none';
        });
    }
    
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
    
    if (filterBtn) {
        filterBtn.addEventListener('click', laadRegistraties);
    }
    
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetFilters);
    }
    
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportExcel);
    }
    
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportPdf);
    }
    
    if (importExcelBtn) {
        importExcelBtn.addEventListener('click', openImportPopup);
    }
    
    if (closeImportPopup) {
        closeImportPopup.addEventListener('click', closeImportPopupFunc);
    }
    
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadTemplate);
    }
    
    // Enter-toets activeert filter
    if (searchZiekenhuis) {
        searchZiekenhuis.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filterBtn) filterBtn.click();
            }
        });
    }

    if (filterDatumVanaf) {
        filterDatumVanaf.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filterBtn) filterBtn.click();
            }
        });
    }

    if (filterDatumTot) {
        filterDatumTot.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filterBtn) filterBtn.click();
            }
        });
    }
    
    initScrollButtons();
    
    console.log('✅ Registraties pagina geïnitialiseerd!');
});

console.log('✅ registraties.js geladen!');