// ============================================================
// PLANNING - Planning pagina (planning.html)
// ============================================================

console.log('🚀 planning.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml, formatDate } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let allePlanningen = [];
let alleAdressen = [];
let currentPlanningId = null;

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
        
        alleAdressen = data || [];
        
        // Vul de select
        adresSelect.innerHTML = '<option value="">Kies een adres...</option>';
        alleAdressen.forEach(adres => {
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
            <div class="datum-header">
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
                        <p>${typeIcon} ${typeLabel} ${extraInfo ? `- ${extraInfo}` : ''}</p>
                        ${planning.opmerkingen ? `<p><em>📝 ${escapeHtml(planning.opmerkingen)}</em></p>` : ''}
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
        btn.addEventListener('click', () => genereerPdfVoorDag(btn.dataset.datum));
    });
    
    // Initialiseer sortable
    initialiseerSortable();
}

// ===== SORTABLE INITIALISATIE =====
function initialiseerSortable() {
    const container = document.querySelector('.sortable-list');
    if (!container) return;
    
    // Wacht tot de DOM volledig is geladen
    setTimeout(() => {
        if (typeof Sortable !== 'undefined') {
            const sortable = new Sortable(container, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                filter: '.datum-header',
                preventOnFilter: false,
                onEnd: async function(evt) {
                    // Haal de nieuwe volgorde op
                    const items = container.querySelectorAll('.planning-item');
                    const updates = [];
                    
                    items.forEach((item, index) => {
                        const id = parseInt(item.dataset.id);
                        if (id) {
                            updates.push({ id: id, volgorde: index });
                        }
                    });
                    
                    // Update de volgorde in de database
                    try {
                        for (const update of updates) {
                            await supabase
                                .from('planningen')
                                .update({ dag_volgorde: update.volgorde })
                                .eq('id', update.id);
                        }
                        showToast('✅ Volgorde opgeslagen!', 'success');
                    } catch (err) {
                        console.error('Fout bij opslaan volgorde:', err);
                        showToast('❌ Fout bij opslaan volgorde: ' + err.message, 'error');
                    }
                }
            });
            
            console.log('✅ Sortable geïnitialiseerd!');
        } else {
            console.warn('⚠️ SortableJS niet gevonden. Controleer de script tags.');
        }
    }, 500);
}

// ===== PLANNINGEN LADEN =====
async function laadPlanningen() {
    if (!planningLijst) return;
    planningLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        const { data, error } = await supabase
            .from('planningen')
            .select('*')
            .order('datum', { ascending: false });
        
        if (error) throw error;
        
        allePlanningen = data || [];
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
        
        // Toon/verberg velden
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
        opmerkingen: opmerkingen || null
    };
    
    if (type === 'ophaling') {
        planningData.aantal_tonnen = parseInt(getValue('aantalTonnen')) || 1;
    } else if (type === 'plaatsing') {
        planningData.aantal_lege_tonnen = parseInt(getValue('aantalLegeTonnen')) || 1;
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
    // Toon een laadmelding
    showToast('📄 PDF wordt gegenereerd...', 'info');
    
    // Haal alle planningen voor deze datum op
    const planningenVoorDag = allePlanningen.filter(p => p.datum === datum);
    
    if (!planningenVoorDag || planningenVoorDag.length === 0) {
        showToast('⚠️ Geen planningen gevonden voor deze dag.', 'error');
        return;
    }
    
    // Bouw de HTML voor de PDF
    const datumObj = new Date(datum + 'T00:00:00');
    const dagVanWeek = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][datumObj.getDay()];
    const datumDisplay = `${dagVanWeek} ${datumObj.getDate()} ${datumObj.toLocaleString('nl-NL', { month: 'long' })} ${datumObj.getFullYear()}`;
    
    let html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #2c7da0; text-align: center;">📋 Dagplanning - ${datumDisplay}</h1>
            <p style="text-align: center; color: #6c757d;">Aantal ritten: ${planningenVoorDag.length}</p>
            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #2c7da0; color: white;">
                        <th style="padding: 10px; text-align: left;">#</th>
                        <th style="padding: 10px; text-align: left;">Type</th>
                        <th style="padding: 10px; text-align: left;">Ziekenhuis</th>
                        <th style="padding: 10px; text-align: left;">Adres</th>
                        <th style="padding: 10px; text-align: left;">Details</th>
                        <th style="padding: 10px; text-align: left;">Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Sorteer op dag_volgorde of index
    const gesorteerd = [...planningenVoorDag].sort((a, b) => (a.dag_volgorde || 0) - (b.dag_volgorde || 0));
    
    gesorteerd.forEach((planning, index) => {
        const adres = alleAdressen.find(a => a.id === planning.adres_id);
        const typeLabel = planning.type === 'ophaling' ? '📦 Ophaling' : '🚚 Plaatsing';
        const statusLabel = planning.status === 'gepland' ? 'Gepland' : 
                          (planning.status === 'uitgevoerd' ? 'Uitgevoerd' : 'Geannuleerd');
        
        let details = '';
        if (planning.type === 'ophaling' && planning.aantal_tonnen) {
            details = `${planning.aantal_tonnen} ton(nen)`;
        } else if (planning.type === 'plaatsing' && planning.aantal_lege_tonnen) {
            details = `${planning.aantal_lege_tonnen} lege ton(nen)`;
        }
        
        html += `
            <tr style="border-bottom: 1px solid #e9ecef;">
                <td style="padding: 10px;"><strong>${index + 1}</strong></td>
                <td style="padding: 10px;">${typeLabel}</td>
                <td style="padding: 10px;"><strong>${adres ? escapeHtml(adres.instelling_naam) : 'Onbekend'}</strong></td>
                <td style="padding: 10px;">${adres ? escapeHtml(adres.straat) : ''}<br>${adres ? escapeHtml(adres.postcode) + ' ' + escapeHtml(adres.plaats) : ''}</td>
                <td style="padding: 10px;">${details}</td>
                <td style="padding: 10px;">${statusLabel}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            ${planningenVoorDag.some(p => p.opmerkingen) ? `
                <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
                <h3 style="color: #2c7da0;">📝 Opmerkingen</h3>
                ${planningenVoorDag.filter(p => p.opmerkingen).map(p => {
                    const adres = alleAdressen.find(a => a.id === p.adres_id);
                    return `<p><strong>${adres ? escapeHtml(adres.instelling_naam) : 'Onbekend'}:</strong> ${escapeHtml(p.opmerkingen)}</p>`;
                }).join('')}
            ` : ''}
            <hr style="border: 1px solid #e9ecef; margin: 20px 0;">
            <p style="text-align: center; color: #6c757d; font-size: 12px;">Gegenereerd op ${new Date().toLocaleString('nl-NL')}</p>
        </div>
    `;
    
    // Gebruik html2pdf om de PDF te genereren
    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin: 10,
            filename: `dagplanning_${datum}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Maak een tijdelijk element voor de PDF
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.style.background = 'white';
        tempDiv.style.padding = '20px';
        tempDiv.style.width = '210mm';
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv);
        
        html2pdf().set(opt).from(tempDiv).save().then(function() {
            document.body.removeChild(tempDiv);
            showToast('✅ PDF succesvol gegenereerd!', 'success');
        }).catch(function(err) {
            document.body.removeChild(tempDiv);
            console.error('PDF fout:', err);
            showToast('❌ Fout bij genereren PDF: ' + err.message, 'error');
        });
    } else {
        showToast('⚠️ html2pdf bibliotheek niet geladen. Controleer de script tags.', 'error');
        console.warn('html2pdf niet gevonden, gebruik fallback...');
        
        // Fallback: print de dagplanning
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    }
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Planning pagina initialiseren...');
    
    // Auth check
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) return;
    
    // Laad adressen voor select
    await laadAdressenVoorSelect();
    
    // Laad planningen
    await laadPlanningen();
    
    // ===== EVENT LISTENERS =====
    
    // Type select toon/verberg velden
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            ophalingVelden.style.display = this.value === 'ophaling' ? 'block' : 'none';
            plaatsingVelden.style.display = this.value === 'plaatsing' ? 'block' : 'none';
        });
    }
    
    // Nieuwe planning knop
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
    
    // Opslaan knop
    if (savePlanningBtn) {
        savePlanningBtn.addEventListener('click', savePlanning);
    }
    
    // Sluiten popup
    if (closePlanningPopup) {
        closePlanningPopup.addEventListener('click', () => {
            planningPopup.style.display = 'none';
        });
    }
    
    // Sluiten bij klik buiten popup
    window.addEventListener('click', (e) => {
        if (e.target === planningPopup) {
            planningPopup.style.display = 'none';
        }
    });
    
    console.log('✅ Planning pagina geïnitialiseerd!');
});

console.log('✅ planning.js geladen!');