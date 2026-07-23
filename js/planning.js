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

// ===== PLANNING FUNCTIES =====

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

function toonPlanning(planningen) {
    if (!planningLijst) return;
    
    if (!planningen || planningen.length === 0) {
        planningLijst.innerHTML = '<p>Geen planningen gevonden. Klik op "+ Nieuwe planning" om er een toe te voegen.</p>';
        return;
    }
    
    // Sorteer op datum
    const gesorteerd = [...planningen].sort((a, b) => new Date(a.datum) - new Date(b.datum));
    
    let html = '';
    
    // Groepeer per datum
    const grouped = {};
    gesorteerd.forEach(p => {
        if (!grouped[p.datum]) grouped[p.datum] = [];
        grouped[p.datum].push(p);
    });
    
    for (const [datum, items] of Object.entries(grouped)) {
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
                <div class="planning-item sortable-item" data-id="${planning.id}">
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
}

async function laadPlanningen() {
    if (!planningLijst) return;
    planningLijst.innerHTML = '<p>Bezig met laden...</p>';
    
    try {
        const { data, error } = await supabase
            .from('planningen')
            .select('*')
            .order('datum', { ascending: true });
        
        if (error) throw error;
        
        allePlanningen = data || [];
        toonPlanning(allePlanningen);
    } catch (err) {
        console.error('Fout bij laden planningen:', err);
        planningLijst.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

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

function genereerPdfVoorDag(datum) {
    showToast('📄 PDF wordt gegenereerd...', 'info');
    // Hier komt de PDF logica
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