// ============================================================
// MODULE - VOORSPELLING (Ophaling analyse voor dashboard)
// ============================================================

// Gebruik de globale supabase
const supabase = window.supabase;

// ===== STATE =====
let huidigeVoorspellingCutoff = 7;

// ===== HULPFUNCTIE =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== VOORSPELLING FUNCTIES =====

export async function laadOphalingAnalyse() {
    const analyseLijst = document.getElementById('analyseLijst');
    if (!analyseLijst) {
        console.warn('analyseLijst element niet gevonden');
        return;
    }

    console.log('📊 Voorspelling wordt geladen...');

    analyseLijst.innerHTML = '<p>Bezig met laden...</p>';

    try {
        const { data, error } = await supabase
            .from('ophaling_analyse')
            .select('*');

        if (error) {
            console.error('Fout bij laden analyse:', error);
            analyseLijst.innerHTML = `<p class="error">Fout bij laden: ${error.message}</p>`;
            return;
        }

        if (!data || data.length === 0) {
            analyseLijst.innerHTML = '<p>Nog geen ophalingen geregistreerd. Voeg ophalingen toe in de registraties.</p>';
            return;
        }

        console.log(`📊 ${data.length} ziekenhuizen gevonden in analyse`);

        const vandaag = new Date();
        vandaag.setHours(0, 0, 0, 0);

        // ===== BEPAAL STATUS PER ZIEKENHUIS =====
        const dataMetStatus = data.map(item => {
            let status = 'Onbekend';
            let dagenSindsLaatste = null;
            let dagenTotVerwachte = null;
            let verwachteDatum = null;

            if (!item.aantal_ophalingen || item.aantal_ophalingen < 2) {
                status = 'Onvoldoende data';
                return { ...item, status, dagenSindsLaatste, dagenTotVerwachte, verwachteDatum };
            }

            if (!item.laatste_ophaling) {
                status = 'Geen data';
                return { ...item, status, dagenSindsLaatste, dagenTotVerwachte, verwachteDatum };
            }

            const laatsteDatum = new Date(item.laatste_ophaling);
            laatsteDatum.setHours(0, 0, 0, 0);

            const gemiddeldInterval = item.gemiddeld_interval || 14;
            const verwachte = new Date(laatsteDatum);
            verwachte.setDate(verwachte.getDate() + gemiddeldInterval);
            verwachte.setHours(0, 0, 0, 0);
            verwachteDatum = verwachte;

            const dagenSindsVerwachte = Math.floor((vandaag - verwachte) / (1000 * 60 * 60 * 24));

            if (dagenSindsVerwachte > 0) {
                status = 'Te laat';
                dagenSindsLaatste = dagenSindsVerwachte;
            } else if (dagenSindsVerwachte >= -3) {
                status = 'Bijna te laat';
                dagenTotVerwachte = Math.abs(dagenSindsVerwachte);
            } else {
                status = 'Op schema';
                dagenTotVerwachte = Math.abs(dagenSindsVerwachte);
            }

            return { ...item, status, dagenSindsLaatste, dagenTotVerwachte, verwachteDatum };
        });

        // ===== FILTER =====
        const altijdTonen = dataMetStatus.filter(item => 
            item.status === 'Te laat' || item.status === 'Bijna te laat'
        );

        const cutoff = huidigeVoorspellingCutoff || 7;
        const binnenkort = dataMetStatus.filter(item => {
            if (item.status === 'Te laat' || item.status === 'Bijna te laat') return false;
            if (item.status !== 'Op schema') return false;
            if (!item.verwachteDatum) return false;

            const dagenVerschil = Math.ceil((item.verwachteDatum - vandaag) / (1000 * 60 * 60 * 24));
            return dagenVerschil >= 0 && dagenVerschil <= cutoff;
        });

        const altijdIds = new Set(altijdTonen.map(i => i.ziekenhuis_id));
        const filteredData = [...altijdTonen];
        for (const item of binnenkort) {
            if (!altijdIds.has(item.ziekenhuis_id)) {
                filteredData.push(item);
            }
        }

        filteredData.sort((a, b) => {
            const statusOrder = {
                'Te laat': 1,
                'Bijna te laat': 2,
                'Binnenkort': 3,
                'Op schema': 4,
                'Onvoldoende data': 5,
                'Geen data': 6
            };
            const orderA = statusOrder[a.status] || 5;
            const orderB = statusOrder[b.status] || 5;
            if (orderA !== orderB) return orderA - orderB;
            return (a.instelling_naam || '').localeCompare(b.instelling_naam || '');
        });

        if (filteredData.length === 0) {
            analyseLijst.innerHTML = `<p>✅ Alle ziekenhuizen zijn op schema. Er zijn geen ophalingen nodig in de komende ${cutoff} dagen.</p>`;
            return;
        }

        // ===== HTML GENEREREN =====
        let html = `<div class="analyse-totaal">⚠️ ${filteredData.length} ziekenhuis(sen) hebben binnenkort een ophaling nodig (binnen ${cutoff} dagen)</div>`;

        for (const item of filteredData) {
            let statusClass = '';
            let statusEmoji = '';
            let statusDisplay = item.status || 'Onbekend';

            switch (item.status) {
                case 'Te laat':
                    statusClass = 'status-danger';
                    statusEmoji = '🔴';
                    break;
                case 'Bijna te laat':
                    statusClass = 'status-warning';
                    statusEmoji = '🟡';
                    break;
                case 'Op schema':
                    statusClass = 'status-success';
                    statusEmoji = '🟢';
                    break;
                case 'Onvoldoende data':
                case 'Geen data':
                default:
                    statusClass = 'status-onvoldoende';
                    statusEmoji = '⚪';
                    break;
            }

            let dagenText = '';
            if (item.dagenSindsLaatste !== null && item.dagenSindsLaatste > 0) {
                dagenText = `<span class="badge badge-danger">${item.dagenSindsLaatste} dagen te laat</span>`;
            } else if (item.dagenTotVerwachte !== null && item.dagenTotVerwachte <= 3) {
                dagenText = `<span class="badge badge-warning">Over ${item.dagenTotVerwachte} dagen verwacht</span>`;
            } else if (item.dagenTotVerwachte !== null && item.dagenTotVerwachte > 3) {
                dagenText = `<span class="badge badge-info">Over ${item.dagenTotVerwachte} dagen</span>`;
            }

            let extraInfo = '';
            if (item.laatste_gewicht) {
                extraInfo = ` | Laatste: ${item.laatste_gewicht} kg (${item.laatste_tonnen || 1} ton)`;
            }

            html += `
                <div class="analyse-item ${statusClass}">
                    <div class="analyse-item-header">
                        <strong>${escapeHtml(item.instelling_naam)}</strong>
                        <span class="analyse-status">${statusEmoji} ${statusDisplay}</span>
                    </div>
                    <div class="analyse-item-details">
                        <div>📍 ${escapeHtml(item.straat)}, ${escapeHtml(item.postcode)} ${escapeHtml(item.plaats)}</div>
                        ${item.contactpersoon_naam ? `<div>👤 ${escapeHtml(item.contactpersoon_naam)} ${item.contactpersoon_email ? `- 📧 ${escapeHtml(item.contactpersoon_email)}` : ''}</div>` : ''}
                        <div class="analyse-stats">
                            <span>📊 Gemiddeld: ${item.gemiddeld_interval} dagen</span>
                            <span>📋 Aantal ophalingen: ${item.aantal_ophalingen}</span>
                            <span>📅 Laatste: ${new Date(item.laatste_ophaling).toLocaleDateString('nl-NL')}${extraInfo}</span>
                            ${item.verwachteDatum ? `<span>🔮 Verwachte volgende: ${new Date(item.verwachteDatum).toLocaleDateString('nl-NL')}</span>` : ''}
                            ${dagenText}
                        </div>
                    </div>
                </div>
            `;
        }

        analyseLijst.innerHTML = html;
        console.log('✅ Voorspelling geladen!');

    } catch (err) {
        console.error('Fout bij laden analyse:', err);
        analyseLijst.innerHTML = `<p class="error">Fout bij laden: ${err.message}</p>`;
    }
}

export function setCutoff(days) {
    huidigeVoorspellingCutoff = days;
    laadOphalingAnalyse();
}

export function getCutoff() {
    return huidigeVoorspellingCutoff;
}

console.log('✅ Voorspelling module geladen!');

// ===== EXPORT =====
export default {
    laadOphalingAnalyse,
    setCutoff,
    getCutoff
};