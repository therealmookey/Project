// ============================================================
// MODULE - ACTIE (Proactief bellen module voor dashboard)
// ============================================================

console.log('📞 Actie module geladen...');

// Gebruik de globale supabase
const supabase = window.supabase;

// ===== HULPFUNCTIES =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Gebruik de globale showToast functie als die bestaat
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Fallback: eenvoudige toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#2c7da0'};
        max-width: 90%;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== ACTIE LIJST LADEN =====
export async function laadActieLijst() {
    const actieContainer = document.getElementById('actieLijst');
    if (!actieContainer) {
        console.warn('⚠️ Actie container niet gevonden');
        return;
    }

    actieContainer.innerHTML = '<p>Bezig met laden...</p>';

    try {
        // Haal de analyse data op
        const { data, error } = await supabase
            .from('ophaling_analyse')
            .select('*');

        if (error) {
            console.error('Fout bij laden actie lijst:', error);
            actieContainer.innerHTML = `<p class="error">Fout bij laden: ${error.message}</p>`;
            return;
        }

        if (!data || data.length === 0) {
            actieContainer.innerHTML = '<p>Nog geen ophalingen geregistreerd.</p>';
            return;
        }

        const vandaag = new Date();
        vandaag.setHours(0, 0, 0, 0);

        // Bepaal welke ziekenhuizen "Te laat" of "Bijna te laat" zijn
        const actieZiekenhuizen = [];
        
        for (const item of data) {
            // Onvoldoende data overslaan
            if (!item.aantal_ophalingen || item.aantal_ophalingen < 2) continue;
            if (!item.laatste_ophaling) continue;

            const laatsteDatum = new Date(item.laatste_ophaling);
            laatsteDatum.setHours(0, 0, 0, 0);

            const gemiddeldInterval = item.gemiddeld_interval || 14;
            const verwachte = new Date(laatsteDatum);
            verwachte.setDate(verwachte.getDate() + gemiddeldInterval);
            verwachte.setHours(0, 0, 0, 0);

            const dagenSindsVerwachte = Math.floor((vandaag - verwachte) / (1000 * 60 * 60 * 24));

            // Alleen "Te laat" of "Bijna te laat" (binnen 3 dagen)
            if (dagenSindsVerwachte > 0 || dagenSindsVerwachte >= -3) {
                // Haal de actie_status op uit de adressen tabel
                const { data: adresData, error: adresError } = await supabase
                    .from('adressen')
                    .select('actie_status, telefoon, contactpersoon_naam')
                    .eq('id', item.ziekenhuis_id)
                    .single();

                let actieStatus = 'geen_status';
                let telefoon = null;
                let contactpersoon = null;
                
                if (!adresError && adresData) {
                    actieStatus = adresData.actie_status || 'geen_status';
                    telefoon = adresData.telefoon;
                    contactpersoon = adresData.contactpersoon_naam;
                }

                // Controleer of er recente registraties zijn (laatste 7 dagen)
                const { count: recenteRegistraties, error: regError } = await supabase
                    .from('ophaalregistraties')
                    .select('*', { count: 'exact', head: true })
                    .eq('ziekenhuis_id', item.ziekenhuis_id)
                    .gte('registratiedatum', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

                const heeftRecenteRegistratie = !regError && recenteRegistraties > 0;

                // Als er een recente registratie is, status overschrijven
                if (heeftRecenteRegistratie) {
                    actieStatus = 'geregistreerd';
                }

                // Alleen toevoegen als status niet 'geregistreerd' is
                if (actieStatus !== 'geregistreerd') {
                    actieZiekenhuizen.push({
                        ...item,
                        actieStatus: actieStatus,
                        dagenSindsVerwachte: dagenSindsVerwachte,
                        heeftRecenteRegistratie: heeftRecenteRegistratie,
                        telefoon: telefoon,
                        contactpersoon: contactpersoon
                    });
                }
            }
        }

        // Sorteer op urgentie (meest te laat eerst)
        actieZiekenhuizen.sort((a, b) => b.dagenSindsVerwachte - a.dagenSindsVerwachte);

        if (actieZiekenhuizen.length === 0) {
            actieContainer.innerHTML = '<p>✅ Alle ziekenhuizen zijn op schema of recent geregistreerd!</p>';
            return;
        }

        // Toon de actie lijst
        toonActieLijst(actieZiekenhuizen);

    } catch (err) {
        console.error('Fout bij laden actie lijst:', err);
        actieContainer.innerHTML = `<p class="error">Fout bij laden: ${err.message}</p>`;
    }
}

// ===== ACTIE LIJST TONEN =====
function toonActieLijst(ziekenhuizen) {
    const actieContainer = document.getElementById('actieLijst');
    if (!actieContainer) return;

    let html = `
        <div class="actie-header">
            <span class="actie-titel">📞 Actie nodig</span>
            <span class="actie-count">${ziekenhuizen.length} ziekenhuizen</span>
        </div>
        <div class="actie-lijst">
    `;

    ziekenhuizen.forEach(item => {
        const isTeLaat = item.dagenSindsVerwachte > 0;
        const urgencyClass = isTeLaat ? 'urgentie-rood' : 'urgentie-geel';
        const urgencyLabel = isTeLaat ? `🔴 ${item.dagenSindsVerwachte} dagen te laat` : `🟡 Over ${Math.abs(item.dagenSindsVerwachte)} dagen`;

        // Bepaal status
        let statusClass = 'status-geen';
        let statusLabel = 'Geen status';
        let statusEmoji = '⚪';

        if (item.actieStatus === 'bevestigd') {
            statusClass = 'status-bevestigd';
            statusLabel = 'Bevestigd';
            statusEmoji = '✅';
        } else if (item.actieStatus === 'nog_geen_ophaling') {
            statusClass = 'status-nog-geen';
            statusLabel = 'Nog geen ophaling';
            statusEmoji = '⏳';
        }

        const heeftTelefoon = item.telefoon && item.telefoon.length > 0;

        html += `
            <div class="actie-item ${urgencyClass}" data-id="${item.ziekenhuis_id}">
                <div class="actie-item-header">
                    <span class="actie-naam">${escapeHtml(item.instelling_naam)}</span>
                    <span class="actie-urgency">${urgencyLabel}</span>
                </div>
                <div class="actie-item-details">
                    <span>📍 ${escapeHtml(item.straat)}, ${escapeHtml(item.plaats)}</span>
                    ${item.telefoon ? `<span>📞 ${escapeHtml(item.telefoon)}</span>` : ''}
                    ${item.contactpersoon ? `<span>👤 ${escapeHtml(item.contactpersoon)}</span>` : ''}
                </div>
                <div class="actie-item-actions">
                    <div class="actie-status-selector">
                        <button class="status-btn ${statusClass === 'status-geen' ? 'active' : ''}" 
                                data-status="geen_status" data-id="${item.ziekenhuis_id}">
                            ⚪ Geen status
                        </button>
                        <button class="status-btn ${statusClass === 'status-bevestigd' ? 'active' : ''}" 
                                data-status="bevestigd" data-id="${item.ziekenhuis_id}">
                            ✅ Bevestigd
                        </button>
                        <button class="status-btn ${statusClass === 'status-nog-geen' ? 'active' : ''}" 
                                data-status="nog_geen_ophaling" data-id="${item.ziekenhuis_id}">
                            ⏳ Nog geen ophaling
                        </button>
                    </div>
                    ${heeftTelefoon ? `
                        <a href="tel:${item.telefoon}" class="btn btn-primary btn-small bell-btn">
                            📞 Bel nu
                        </a>
                    ` : ''}
                    <button class="btn btn-secondary btn-small verwijder-actie-btn" data-id="${item.ziekenhuis_id}">
                        ✖ Verwijder
                    </button>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    actieContainer.innerHTML = html;

    // Event listeners voor status knoppen
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const status = this.dataset.status;
            const id = this.dataset.id;
            await updateActieStatus(id, status);
        });
    });

    // Event listeners voor verwijderen
    document.querySelectorAll('.verwijder-actie-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = this.dataset.id;
            if (confirm('Weet je zeker dat je dit ziekenhuis uit de actie lijst wilt verwijderen?')) {
                await verwijderUitActieLijst(id);
            }
        });
    });
}

// ===== ACTIE STATUS UPDATE =====
async function updateActieStatus(ziekenhuisId, status) {
    try {
        const { error } = await supabase
            .from('adressen')
            .update({ actie_status: status })
            .eq('id', ziekenhuisId);

        if (error) throw error;

        showToast(`✅ Status bijgewerkt naar: ${status}`, 'success');
        
        // Herlaad de actie lijst
        laadActieLijst();

    } catch (err) {
        console.error('Fout bij updaten status:', err);
        showToast('❌ Fout bij updaten status: ' + err.message, 'error');
    }
}

// ===== VERWIJDER UIT ACTIE LIJST =====
async function verwijderUitActieLijst(ziekenhuisId) {
    try {
        // Zet de status naar 'geen_status' zodat hij uit de lijst verdwijnt
        await updateActieStatus(ziekenhuisId, 'geen_status');
        showToast('✅ Ziekenhuis verwijderd uit actie lijst', 'success');
    } catch (err) {
        console.error('Fout bij verwijderen:', err);
        showToast('❌ Fout bij verwijderen: ' + err.message, 'error');
    }
}

// ===== EXPORT =====
export default {
    laadActieLijst
};