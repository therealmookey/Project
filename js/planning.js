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

// ===== HULPFUNCTIE: Nummering per dag =====
function updatePlanningNumbers() {
    const containers = document.querySelectorAll('.sortable-list');
    
    containers.forEach(container => {
        const items = container.querySelectorAll('.planning-item');
        const groupedByDatum = {};
        
        items.forEach(item => {
            const datum = item.dataset.datum;
            if (!groupedByDatum[datum]) {
                groupedByDatum[datum] = [];
            }
            groupedByDatum[datum].push(item);
        });
        
        for (const [datum, datumItems] of Object.entries(groupedByDatum)) {
            datumItems.forEach((item, index) => {
                const badge = item.querySelector('.stop-number-badge');
                if (badge) {
                    badge.textContent = `#${index + 1}`;
                }
                item.dataset.volgorde = index;
            });
        }
    });
}

// ===== HULPFUNCTIE: Opslaan volgorde per dag =====
async function savePlanningOrder() {
    const containers = document.querySelectorAll('.sortable-list');
    const allUpdates = [];
    
    containers.forEach(container => {
        const items = container.querySelectorAll('.planning-item');
        const groupedByDatum = {};
        
        items.forEach(item => {
            const datum = item.dataset.datum;
            if (!groupedByDatum[datum]) {
                groupedByDatum[datum] = [];
            }
            groupedByDatum[datum].push(item);
        });
        
        for (const [datum, datumItems] of Object.entries(groupedByDatum)) {
            datumItems.forEach((item, index) => {
                const id = parseInt(item.dataset.id);
                if (id) {
                    allUpdates.push({ id: id, volgorde: index });
                }
            });
        }
    });
    
    if (allUpdates.length === 0) return;
    
    try {
        for (const update of allUpdates) {
            await supabase
                .from('planningen')
                .update({ dag_volgorde: update.volgorde })
                .eq('id', update.id);
            
            const planning = allePlanningen.find(p => p.id === update.id);
            if (planning) {
                planning.dag_volgorde = update.volgorde;
            }
        }
        showToast('✅ Volgorde opgeslagen!', 'success');
    } catch (err) {
        console.error('Fout bij opslaan volgorde:', err);
        showToast('❌ Fout bij opslaan volgorde: ' + err.message, 'error');
        await laadPlanningen();
    }
}

// ===== SORTABLE INITIALISATIE =====
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
                onEnd: async function(evt) {
                    console.log('🔄 Sorteren voltooid');
                    updatePlanningNumbers();
                    await savePlanningOrder();
                }
            });
            
            container._sortable = sortable;
            console.log(`✅ Sortable geïnitialiseerd voor container ${index + 1}`);
        } catch (err) {
            console.error(`Fout bij initialiseren sortable container ${index + 1}:`, err);
        }
    });
}

// ===== TOON PLANNING =====
function toonPlanning(planningen) {
    if (!planningLijst) return;
    
    if (!planningen || planningen.length === 0) {
        planningLijst.innerHTML = '<p>Geen planningen gevonden. Klik op "+ Nieuwe planning" om er een toe te voegen.</p>';
        return;
    }
    
    const gesorteerd = [...planningen].sort((a, b) => new Date(b.datum) - new Date(a.datum));
    
    let html = '<div class="sortable-list">';
    
    const grouped = {};
    gesorteerd.forEach(p => {
        if (!grouped[p.datum]) grouped[p.datum] = [];
        grouped[p.datum].push(p);
    });
    
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    
    for (const datum of sortedDates) {
        const items = grouped[datum];
        items.sort((a, b) => (a.dag_volgorde || 0) - (b.dag_volgorde || 0));
        
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
                    <button class="btn btn-success btn-small ai-optimize-btn" data-datum="${datum}" title="AI optimaliseert de volgorde voor deze dag">🤖 Optimaliseer</button>
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
            
            const adresExtraInfo = adres?.extra_info ? escapeHtml(adres.extra_info) : '';
            const adresTelefoon = adres?.telefoon ? escapeHtml(adres.telefoon) : '';
            const adresContact = adres?.contactpersoon_naam ? escapeHtml(adres.contactpersoon_naam) : '';
            
            html += `
                <div class="planning-item sortable-item" data-id="${planning.id}" data-datum="${planning.datum}" data-volgorde="${planning.dag_volgorde || index}">
                    <div class="planning-info">
                        <div class="planning-header">
                            <span class="drag-handle" title="Sleep om te sorteren">⠿</span>
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
    
    // Event listeners
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async function() {
            const id = this.dataset.id;
            const status = this.value;
            await updatePlanningStatus(id, status);
        });
    });
    
    document.querySelectorAll('.edit-planning-btn').forEach(btn => {
        btn.addEventListener('click', () => bewerkPlanning(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-planning-btn').forEach(btn => {
        btn.addEventListener('click', () => verwijderPlanning(btn.dataset.id));
    });
    
    document.querySelectorAll('.pdf-dag-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const datum = this.dataset.datum;
            console.log('📄 PDF knop geklikt voor datum:', datum);
            genereerPdfVoorDag(datum);
        });
    });
    
    // AI optimalisatie knop
    document.querySelectorAll('.ai-optimize-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const datum = this.dataset.datum;
            console.log('🤖 AI optimalisatie knop geklikt voor datum:', datum);
            aiOptimizeDag(datum);
        });
    });
    
    // Initialiseer sortable en nummering
    setTimeout(() => {
        updatePlanningNumbers();
        initialiseerSortable();
    }, 300);
}

// ===== AI OPTIMALISATIE FUNCTIES =====

/**
 * AI optimalisatie voor een specifieke dag
 * @param {string} datum - De datum in YYYY-MM-DD formaat
 */
async function aiOptimizeDag(datum) {
    console.log('🤖 AI optimalisatie gestart voor:', datum);
    showToast('🤖 AI berekent de optimale volgorde...', 'info');
    
    try {
        // Haal alle planningen voor deze dag op
        const planningenVoorDag = allePlanningen.filter(p => p.datum === datum);
        
        if (!planningenVoorDag || planningenVoorDag.length === 0) {
            showToast('⚠️ Geen planningen gevonden voor deze dag.', 'error');
            return;
        }
        
        if (planningenVoorDag.length < 2) {
            showToast('⚠️ Er zijn minstens 2 ritten nodig om te optimaliseren.', 'error');
            return;
        }
        
        // Verzamel adresgegevens voor elke planning
        const rittenData = planningenVoorDag.map(planning => {
            const adres = alleAdressen.find(a => a.id === planning.adres_id);
            return {
                id: planning.id,
                adres_id: planning.adres_id,
                instelling_naam: adres?.instelling_naam || 'Onbekend',
                straat: adres?.straat || '',
                postcode: adres?.postcode || '',
                plaats: adres?.plaats || '',
                type: planning.type,
                datum: planning.datum,
                extra_info: adres?.extra_info || '',
                contactpersoon_naam: adres?.contactpersoon_naam || '',
                telefoon: adres?.telefoon || ''
            };
        });
        
        console.log('📋 Data voor AI optimalisatie:', rittenData);
        
        // Roep de Edge Function aan voor route optimalisatie
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
            showToast('⚠️ Je bent niet ingelogd. Log opnieuw in.', 'error');
            return;
        }
        
        const response = await fetch(
            'https://jcdqcgviossmrvlgsiqd.supabase.co/functions/v1/route-optimizer',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ritten: rittenData,
                    datum: datum,
                    startpunt: localStorage.getItem('startpunt') || 'Schoonmansveld 48, 2870 Puurs'
                })
            }
        );
        
        // Log de response voor debugging
        console.log('📡 Response status:', response.status);
        const responseText = await response.text();
        console.log('📡 Response text:', responseText);
        
        // Probeer te parsen als JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('❌ Kon response niet parsen als JSON:', parseError);
            showToast('❌ Fout: Ongeldige response van server', 'error');
            return;
        }
        
        if (!response.ok) {
            console.error('❌ Server error:', result);
            throw new Error(result.error || `Server error: ${response.status}`);
        }
        
        console.log('✅ AI optimalisatie resultaat:', result);
        
        // Verwerk de nieuwe volgorde
        if (result.optimalisatie && result.optimalisatie.length > 0) {
            // Update de volgorde in de database
            for (const rit of result.optimalisatie) {
                await supabase
                    .from('planningen')
                    .update({ dag_volgorde: rit.volgorde })
                    .eq('id', rit.id);
                
                // Update lokale data
                const planning = allePlanningen.find(p => p.id === rit.id);
                if (planning) {
                    planning.dag_volgorde = rit.volgorde;
                }
            }
            
            // Herlaad de planning om de nieuwe volgorde te tonen
            await laadPlanningen();
            
            showToast('✅ Route geoptimaliseerd! De AI heeft de beste volgorde gevonden.', 'success');
        } else {
            showToast('⚠️ Geen optimalisatie mogelijk. De huidige volgorde blijft behouden.', 'warning');
        }
        
    } catch (err) {
        console.error('Fout bij AI optimalisatie:', err);
        showToast('❌ Fout bij AI optimalisatie: ' + (err.message || 'Onbekende fout'), 'error');
    }
}

// ===== PLANNINGEN LADEN =====
async function laadPlanningen() {
    if (!planningLijst) return;
    planningLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        const { data: adressenData, error: adressenError } = await supabase
            .from('adressen')
            .select('*')
            .order('instelling_naam');
        
        if (adressenError) throw adressenError;
        alleAdressen = adressenData || [];
        
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
    
    const gesorteerd = [...planningenVoorDag].sort((a, b) => (a.dag_volgorde || 0) - (b.dag_volgorde || 0));
    
    console.log(`📋 ${gesorteerd.length} planningen voor PDF (gesorteerd op volgorde)`);
    
    const pdfHtml = buildPdfHtml(datum, gesorteerd);
    printPdf(pdfHtml, datum);
}

// ===== PDF HTML BUILDER =====
function buildPdfHtml(datum, planningen) {
    const datumObj = new Date(datum + 'T00:00:00');
    const dagVanWeek = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][datumObj.getDay()];
    const datumDisplay = `${dagVanWeek} ${datumObj.getDate()} ${datumObj.toLocaleString('nl-NL', { month: 'long' })} ${datumObj.getFullYear()}`;
    
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