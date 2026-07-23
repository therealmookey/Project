// ============================================================
// PLANNING - Planning pagina (planning.html)
// ============================================================

console.log('🚀 planning.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let allePlanningen = [];
let alleAdressen = [];
let currentPlanningId = null;

// ===== DEBUG FUNCTIE =====
window.debugPlanning = function() {
    console.log('📋 Alle adressen:', alleAdressen);
    console.log('📋 Aantal adressen:', alleAdressen?.length || 0);
    if (alleAdressen && alleAdressen.length > 0) {
        console.log('📋 Eerste adres:', alleAdressen[0]);
        console.log('📋 Extra info van eerste adres:', alleAdressen[0]?.extra_info || '(leeg)');
        console.log('📋 Telefoon van eerste adres:', alleAdressen[0]?.telefoon || '(leeg)');
        console.log('📋 Contact van eerste adres:', alleAdressen[0]?.contactpersoon_naam || '(leeg)');
    }
    console.log('📋 Alle planningen:', allePlanningen);
    console.log('📋 Aantal planningen:', allePlanningen?.length || 0);
};

// ===== DOM ELEMENTEN =====
const planningLijst = document.getElementById('planningLijst');
const newPlanningBtn = document.getElementById('newPlanningBtn');
const planningPopup = document.getElementById('planningPopup');
const savePlanningBtn = document.getElementById('savePlanningBtn');
const closePlanningPopup = document.getElementById('closePlanningPopup');
const planningPopupTitle = document.getElementById('planningPopupTitle');
const typeSelect = document.getElementById('typeSelect');
const adresSelect = document.getElementById('adresSelect');
const planningDatum = document.getElementById('planningDatum');
const ophalingVelden = document.getElementById('ophalingVelden');
const plaatsingVelden = document.getElementById('plaatsingVelden');
const aantalTonnen = document.getElementById('aantalTonnen');
const aantalLegeTonnen = document.getElementById('aantalLegeTonnen');
const opmerkingen = document.getElementById('opmerkingen');

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

// ===== ADRESSEN VOOR SELECT =====
async function laadAdressenVoorSelect() {
    try {
        const { data, error } = await supabase
            .from('adressen')
            .select('id, instelling_naam, straat, plaats')
            .order('instelling_naam');
        
        if (error) throw error;
        
        // Vul de select (maar vervang alleAdressen niet, want die heeft al de volledige data)
        const adressenVoorSelect = data || [];
        adresSelect.innerHTML = '<option value="">Kies een adres...</option>';
        adressenVoorSelect.forEach(adres => {
            const option = document.createElement('option');
            option.value = adres.id;
            option.textContent = `${adres.instelling_naam} - ${adres.straat}, ${adres.plaats}`;
            adresSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Fout bij laden adressen voor select:', err);
        showToast('Fout bij laden adressen: ' + err.message, 'error');
    }
}

// ===== TOON PLANNING =====
function toonPlanning(planningen) {
    if (!planningLijst) return;
    
    console.log('📋 toonPlanning aangeroepen met', planningen.length, 'planningen');
    console.log('📋 Aantal adressen beschikbaar:', alleAdressen.length);
    
    if (!planningen || planningen.length === 0) {
        planningLijst.innerHTML = '<p>Geen planningen gevonden. Klik op "+ Nieuwe planning" om er een toe te voegen.</p>';
        return;
    }
    
    // Sorteer op datum (NIEUWSTE EERST)
    const gesorteerd = [...planningen].sort((a, b) => new Date(b.datum) - new Date(a.datum));
    
    let html = '<div class="sortable-list">';
    
    // Groepeer per datum
    const grouped = {};
    gesorteerd.forEach(p => {
        if (!grouped[p.datum]) grouped[p.datum] = [];
        grouped[p.datum].push(p);
    });
    
    // Sorteer datums (nieuwste eerst)
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    
    for (const datum of sortedDates) {
        const items = grouped[datum];
        const datumObj = new Date(datum + 'T00:00:00');
        const dagVanWeek = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][datumObj.getDay()];
        const datumDisplay = `${dagVanWeek} ${datumObj.getDate()} ${datumObj.toLocaleString('nl-NL', { month: 'long' })} ${datumObj.getFullYear()}`;
        
        html += `
            <div class="datum-header" data-datum="${datum}">
                <div class="datum-header-content">
                    <span class="datum-dag">📅 ${datumDisplay}</span>
                    <span class="datum-count">${items.length} ritten</span>
                </div>
                <div class="datum-actions">
                    <button class="btn btn-primary btn-small pdf-dag-btn" data-datum="${datum}">📄 PDF</button>
                </div>
            </div>
        `;
        
        items.forEach((planning, index) => {
            const adres = alleAdressen.find(a => a.id === planning.adres_id);
            
            // DEBUG: Log adres info
            if (adres) {
                console.log(`📍 Adres ${index + 1}:`, {
                    naam: adres.instelling_naam,
                    extra_info: adres.extra_info,
                    telefoon: adres.telefoon,
                    contact: adres.contactpersoon_naam
                });
            } else {
                console.warn(`⚠️ Geen adres gevonden voor planning ${planning.id}, adres_id: ${planning.adres_id}`);
            }
            
            const typeIcon = planning.type === 'ophaling' ? '📦' : '🚚';
            const typeLabel = planning.type === 'ophaling' ? 'Ophaling' : 'Plaatsing';
            const statusClass = planning.status === 'gepland' ? 'status-gepland' : 
                              (planning.status === 'uitgevoerd' ? 'status-uitgevoerd' : 'status-geannuleerd');
            const statusLabel = planning.status === 'gepland' ? 'Gepland' : 
                              (planning.status === 'uitgevoerd' ? 'Uitgevoerd' : 'Geannuleerd');
            
            let extraInfo = '';
            if (planning.type === 'ophaling' && planning.aantal_tonnen) {
                extraInfo = `${planning.aantal_tonnen} ton(nen)`;
            } else if (planning.type === 'plaatsing' && planning.aantal_lege_tonnen) {
                extraInfo = `${planning.aantal_lege_tonnen} lege ton(nen)`;
            }
            
            // Adres extra info (route, parkeren, laadperron, etc.)
            const adresExtraInfo = adres?.extra_info ? escapeHtml(adres.extra_info) : '';
            const adresTelefoon = adres?.telefoon ? escapeHtml(adres.telefoon) : '';
            const adresContact = adres?.contactpersoon_naam ? escapeHtml(adres.contactpersoon_naam) : '';
            
            html += `
                <div class="planning-item sortable-item" data-id="${planning.id}" data-datum="${planning.datum}">
                    <div class="planning-info">
                        <div class="planning-header">
                            <span class="drag-handle">⠿</span>
                            <span class="stop-number-badge">#${index + 1}</span>
                            <h4>${adres ? escapeHtml(adres.instelling_naam) : 'Onbekend'}</h4>
                            <span class="planning-status ${statusClass}">${statusLabel}</span>
                        </div>
                        <p>📍 ${adres ? escapeHtml(adres.straat) : ''}, ${adres ? escapeHtml(adres.plaats) : ''}</p>
                        ${adresTelefoon ? `<p>📞 ${adresTelefoon}</p>` : ''}
                        ${adresContact ? `<p>👤 ${adresContact}</p>` : ''}
                        ${adresExtraInfo ? `<p class="adres-extra-info">📝 ${adresExtraInfo}</p>` : ''}
                        <p>${typeIcon} ${typeLabel} ${extraInfo ? `- ${extraInfo}` : ''}</p>
                        ${planning.opmerkingen ? `<p class="planning-opmerking">📝 ${escapeHtml(planning.opmerkingen)}</p>` : ''}
                    </div>
                    <div class="planning-buttons">
                        <select class="status-select" data-id="${planning.id}">
                            <option value="gepland" ${planning.status === 'gepland' ? 'selected' : ''}>Gepland</option>
                            <option value="uitgevoerd" ${planning.status === 'uitgevoerd' ? 'selected' : ''}>Uitgevoerd</option>
                            <option value="geannuleerd" ${planning.status === 'geannuleerd' ? 'selected' : ''}>Geannuleerd</option>
                        </select>
                        <button class="btn btn-secondary edit-planning-btn" data-id="${planning.id}">✏️ Bewerken</button>
                        <button class="btn btn-danger delete-planning-btn" data-id="${planning.id}">🗑️</button>
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    planningLijst.innerHTML = html;
    
    // Event listeners voor status select
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async function() {
            const id = this.dataset.id;
            const status = this.value;
            await updatePlanningStatus(id, status);
        });
    });
    
    // Event listeners voor bewerken
    document.querySelectorAll('.edit-planning-btn').forEach(btn => {
        btn.addEventListener('click', () => bewerkPlanning(btn.dataset.id));
    });
    
    // Event listeners voor verwijderen
    document.querySelectorAll('.delete-planning-btn').forEach(btn => {
        btn.addEventListener('click', () => verwijderPlanning(btn.dataset.id));
    });
    
    // Event listeners voor PDF
    document.querySelectorAll('.pdf-dag-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const datum = this.dataset.datum;
            console.log('📄 PDF knop geklikt voor datum:', datum);
            genereerPdfVoorDag(datum);
        });
    });
    
    // Initialiseer sortable
    setTimeout(() => initialiseerSortable(), 300);
}

// ===== SORTABLE INITIALISATIE (MET HERLADEN) =====
function initialiseerSortable() {
    if (typeof Sortable === 'undefined') {
        console.warn('⚠️ SortableJS niet geladen');
        return;
    }
    
    const containers = document.querySelectorAll('.sortable-list');
    if (!containers || containers.length === 0) {
        console.warn('⚠️ Geen sortable containers gevonden');
        return;
    }
    
    containers.forEach((container, index) => {
        try {
            if (container._sortable) {
                container._sortable.destroy();
            }
            
            const sortable = new Sortable(container, {
                draggable: '.planning-item',
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                filter: '.datum-header',
                preventOnFilter: false,
                group: 'planning',
                delay: 0,
                forceFallback: false,
                onStart: function(evt) {
                    console.log('🔄 Sorteren gestart voor item:', evt.item.dataset.id);
                },
                onEnd: async function(evt) {
                    console.log('🔄 Sorteren voltooid voor item:', evt.item.dataset.id);
                    
                    const items = container.querySelectorAll('.planning-item');
                    const updates = [];
                    
                    items.forEach((item, index) => {
                        const id = parseInt(item.dataset.id);
                        if (id) {
                            updates.push({ id: id, volgorde: index });
                        }
                    });
                    
                    try {
                        for (const update of updates) {
                            await supabase
                                .from('planningen')
                                .update({ dag_volgorde: update.volgorde })
                                .eq('id', update.id);
                        }
                        showToast('✅ Volgorde opgeslagen!', 'success');
                        
                        // ===== HERLAAD DE PLANNINGEN =====
                        // Dit zorgt ervoor dat allePlanningen wordt bijgewerkt
                        await laadPlanningen();
                        
                    } catch (err) {
                        console.error('Fout bij opslaan volgorde:', err);
                        showToast('❌ Fout bij opslaan volgorde: ' + err.message, 'error');
                    }
                }
            });
            
            container._sortable = sortable;
            console.log(`✅ Sortable geïnitialiseerd voor container ${index + 1}`);
        } catch (err) {
            console.error(`Fout bij initialiseren sortable container ${index + 1}:`, err);
        }
    });
}

// ===== PLANNINGEN LADEN =====
async function laadPlanningen() {
    if (!planningLijst) return;
    planningLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        // Eerst alle adressen ophalen (MET alle velden)
        const { data: adressenData, error: adressenError } = await supabase
            .from('adressen')
            .select('*')
            .order('instelling_naam');
        
        if (adressenError) throw adressenError;
        
        alleAdressen = adressenData || [];
        console.log('📋 Adressen geladen:', alleAdressen.length);
        console.log('📋 Eerste adres met extra info:', alleAdressen[0]?.instelling_naam, '→', alleAdressen[0]?.extra_info || '(geen extra info)');
        
        // Dan planningen ophalen
        const { data, error } = await supabase
            .from('planningen')
            .select('*')
            .order('datum', { ascending: false });
        
        if (error) throw error;
        
        allePlanningen = data || [];
        console.log('📋 Planningen geladen:', allePlanningen.length);
        toonPlanning(allePlanningen);
    } catch (err) {
        console.error('Fout bij laden planningen:', err);
        planningLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== STATUS UPDATE =====
async function updatePlanningStatus(id, status) {
    try {
        const { error } = await supabase
            .from('planningen')
            .update({ status: status })
            .eq('id', id);
        
        if (error) throw error;
        showToast('✅ Status bijgewerkt!', 'success');
        await laadPlanningen();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
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
        setValue('aantalTonnen', data.aantal_tonnen || 1);
        setValue('aantalLegeTonnen', data.aantal_lege_tonnen || 1);
        setValue('opmerkingen', data.opmerkingen || '');
        
        ophalingVelden.style.display = data.type === 'ophaling' ? 'block' : 'none';
        plaatsingVelden.style.display = data.type === 'plaatsing' ? 'block' : 'none';
        
        planningPopup.style.display = 'flex';
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
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
        showToast('✅ Planning verwijderd!', 'success');
        await laadPlanningen();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== PLANNING OPSLAAN =====
async function savePlanning() {
    const type = getValue('typeSelect');
    const adres_id = getValue('adresSelect');
    const datum = getValue('planningDatum');
    const opmerkingen = getValue('opmerkingen');
    
    if (!type || !adres_id || !datum) {
        showToast('Vul alle verplichte velden in', 'error');
        return;
    }
    
    const planningData = {
        type: type,
        adres_id: parseInt(adres_id),
        datum: datum,
        opmerkingen: opmerkingen || null,
        status: 'gepland'
    };
    
    if (type === 'ophaling') {
        planningData.aantal_tonnen = parseInt(getValue('aantalTonnen')) || 1;
        planningData.aantal_lege_tonnen = null;
    } else if (type === 'plaatsing') {
        planningData.aantal_lege_tonnen = parseInt(getValue('aantalLegeTonnen')) || 1;
        planningData.aantal_tonnen = null;
    }
    
    try {
        let result;
        if (currentPlanningId) {
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
        
        showToast('✅ Planning opgeslagen!', 'success');
        planningPopup.style.display = 'none';
        await laadPlanningen();
        await laadAdressenVoorSelect();
    } catch (err) {
        showToast('Fout: ' + err.message, 'error');
    }
}

// ===== PDF GENEREREN =====
function genereerPdfVoorDag(datum) {
    console.log('📄 PDF genereren voor datum:', datum);
    
    const planningenVoorDag = allePlanningen.filter(p => p.datum === datum);
    
    if (!planningenVoorDag || planningenVoorDag.length === 0) {
        showToast('⚠️ Geen planningen gevonden voor deze dag.', 'error');
        return;
    }
    
    console.log(`📋 ${planningenVoorDag.length} planningen gevonden voor PDF`);
    
    const pdfHtml = buildPdfHtml(datum, planningenVoorDag);
    printPdf(pdfHtml, datum);
}

// ===== PDF HTML BUILDER (MET ZELFDE OPMAAK ALS PLANNING) =====
function buildPdfHtml(datum, planningen) {
    const datumObj = new Date(datum + 'T00:00:00');
    const dagVanWeek = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][datumObj.getDay()];
    const datumDisplay = `${dagVanWeek} ${datumObj.getDate()} ${datumObj.toLocaleString('nl-NL', { month: 'long' })} ${datumObj.getFullYear()}`;
    
    // Sorteer op dag_volgorde
    const gesorteerd = [...planningen].sort((a, b) => (a.dag_volgorde || 0) - (b.dag_volgorde || 0));
    
    let itemsHtml = '';
    
    gesorteerd.forEach((planning, index) => {
        const adres = alleAdressen.find(a => a.id === planning.adres_id);
        const typeIcon = planning.type === 'ophaling' ? '📦' : '🚚';
        const typeLabel = planning.type === 'ophaling' ? 'Ophaling' : 'Plaatsing';
        
        let extraInfo = '';
        if (planning.type === 'ophaling' && planning.aantal_tonnen) {
            extraInfo = `${planning.aantal_tonnen} ton(nen)`;
        } else if (planning.type === 'plaatsing' && planning.aantal_lege_tonnen) {
            extraInfo = `${planning.aantal_lege_tonnen} lege ton(nen)`;
        }
        
        const adresNaam = adres ? escapeHtml(adres.instelling_naam) : 'Onbekend';
        const adresStraat = adres ? escapeHtml(adres.straat) : '';
        const adresPlaats = adres ? escapeHtml(adres.plaats) : '';
        const adresTelefoon = adres?.telefoon ? escapeHtml(adres.telefoon) : '';
        const adresContact = adres?.contactpersoon_naam ? escapeHtml(adres.contactpersoon_naam) : '';
        const adresExtraInfo = adres?.extra_info ? escapeHtml(adres.extra_info) : '';
        
        // Bouw contact/telefoon regel
        let contactRegel = '';
        if (adresTelefoon && adresContact) {
            contactRegel = `📞 ${adresTelefoon}  |  👤 ${adresContact}`;
        } else if (adresTelefoon) {
            contactRegel = `📞 ${adresTelefoon}`;
        } else if (adresContact) {
            contactRegel = `👤 ${adresContact}`;
        }
        
        itemsHtml += `
            <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e9ecef;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: #2c7da0; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; min-width: 28px; text-align: center;">#${index + 1}</span>
                        <strong style="color: #2c7da0; font-size: 16px;">${adresNaam}</strong>
                    </div>
                    <span style="background: #e9ecef; padding: 2px 12px; border-radius: 12px; font-size: 11px;">${typeIcon} ${typeLabel}</span>
                </div>
                
                <div style="margin-left: 38px; font-size: 13px; line-height: 1.6; color: #333;">
                    <div>📍 ${adresStraat}, ${adresPlaats}</div>
                    ${contactRegel ? `<div>${contactRegel}</div>` : ''}
                    ${extraInfo ? `<div>📦 ${extraInfo}</div>` : ''}
                    ${adresExtraInfo ? `<div style="background: #fff8e1; padding: 6px 10px; border-radius: 4px; margin-top: 4px; font-size: 12px; color: #6d5d00; border-left: 3px solid #ffc107;">📝 ${adresExtraInfo}</div>` : ''}
                    ${planning.opmerkingen ? `<div style="background: #e3f2fd; padding: 6px 10px; border-radius: 4px; margin-top: 4px; font-size: 12px; color: #0d47a1; border-left: 3px solid #2196f3;">📝 ${escapeHtml(planning.opmerkingen)}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Dagplanning ${datum}</title>
            <style>
                body { 
                    font-family: Arial, Helvetica, sans-serif; 
                    padding: 30px; 
                    color: #333; 
                    max-width: 900px; 
                    margin: 0 auto;
                }
                h1 { 
                    color: #2c7da0; 
                    text-align: center; 
                    font-size: 24px; 
                    margin-bottom: 5px; 
                }
                .subtitle { 
                    text-align: center; 
                    color: #6c757d; 
                    font-size: 14px; 
                    margin-bottom: 20px; 
                }
                .header-info { 
                    display: flex; 
                    justify-content: space-between; 
                    font-size: 12px; 
                    color: #6c757d; 
                    margin-bottom: 20px; 
                    padding: 10px 0;
                    border-top: 2px solid #2c7da0;
                    border-bottom: 1px solid #e9ecef;
                }
                .footer { 
                    text-align: center; 
                    color: #adb5bd; 
                    font-size: 10px; 
                    margin-top: 30px; 
                    border-top: 1px solid #e9ecef; 
                    padding-top: 15px; 
                }
                hr { 
                    border: none; 
                    border-top: 1px solid #e9ecef; 
                    margin: 15px 0; 
                }
                .no-print {
                    display: none;
                }
                @media print {
                    body { padding: 15px; }
                    .no-print { display: none; }
                    .planning-item { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <h1>📋 Dagplanning</h1>
            <p class="subtitle">${datumDisplay}</p>
            <div class="header-info">
                <span>📊 Aantal ritten: ${gesorteerd.length}</span>
                <span>🕐 Gegenereerd: ${new Date().toLocaleString('nl-NL')}</span>
            </div>
            
            ${itemsHtml}
            
            <div class="footer">
                Automatisch gegenereerde dagplanning
            </div>
        </body>
        </html>
    `;
}

// ===== PDF PRINT =====
function printPdf(html, datum) {
    console.log('📄 PDF afdrukken...');
    
    try {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            showToast('⚠️ Pop-up blocker geblokkeerd. Sta pop-ups toe voor deze site.', 'error');
            return;
        }
        
        printWindow.document.write(html);
        printWindow.document.close();
        
        printWindow.onload = function() {
            setTimeout(function() {
                printWindow.focus();
                printWindow.print();
                showToast('✅ PDF geopend voor afdrukken!', 'success');
            }, 500);
        };
    } catch (err) {
        console.error('PDF error:', err);
        showToast('❌ Fout bij genereren PDF: ' + err.message, 'error');
    }
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Planning pagina initialiseren...');
    
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) return;
    
    await laadPlanningen();
    await laadAdressenVoorSelect();
    
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            ophalingVelden.style.display = this.value === 'ophaling' ? 'block' : 'none';
            plaatsingVelden.style.display = this.value === 'plaatsing' ? 'block' : 'none';
        });
    }
    
    if (newPlanningBtn) {
        newPlanningBtn.addEventListener('click', () => {
            currentPlanningId = null;
            planningPopupTitle.textContent = 'Nieuwe planning';
            setValue('typeSelect', '');
            setValue('adresSelect', '');
            setValue('planningDatum', new Date().toISOString().split('T')[0]);
            setValue('aantalTonnen', '1');
            setValue('aantalLegeTonnen', '1');
            setValue('opmerkingen', '');
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

console.log('✅ planning.js geladen!');