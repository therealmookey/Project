// ============================================================
// MODULE - VOORSPELLING (Ophaling analyse voor dashboard)
// ============================================================

// Gebruik de globale supabase (aangemaakt door config.js)
const supabase = window.supabase;

// ===== STATE =====
let huidigeVoorspellingCutoff = 7; // Standaard 7 dagen

// ===== HULPFUNCTIE =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== VOORSPELLING FUNCTIES =====

/**
 * Laad de ophaling analyse met de huidige cutoff
 */
export async function laadOphalingAnalyse() {
    const analyseLijst = document.getElementById('analyseLijst');
    if (!analyseLijst) return;

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

        const vandaag = new Date();
        vandaag.setHours(0, 0, 0, 0);

        // ===== BEPAAL STATUS PER ZIEKENHUIS =====
        const dataMetStatus = data.map(item => {
            let status = 'Onbekend';
            let dagenSindsLaatste = null;
            let dagenTotVerwachte = null;
            let verwachteDatum = null;

            // Onvoldoende data (minder dan 2 ophalingen)
            if (!item.aantal_ophalingen || item.aantal_ophalingen < 2) {
                status = 'Onvoldoende data';
                return { ...item, status, dagenSindsLaatste, dagenTotVerwachte, verwachteDatum };
            }

            // Geen laatste ophaling
            if (!item.laatste_ophaling) {
                status = 'Geen data';
                return { ...item, status, dagenSindsLaatste, dagenTotVerwachte, verwachteDatum };
            }

            const laatsteDatum = new Date(item.laatste_ophaling);
            laatsteDatum.setHours(0, 0, 0, 0);

            const gemiddeldInterval = item.gemiddeld_interval || 14; // Fallback naar 14 dagen
            const verwachte = new Date(laatsteDatum);
            verwachte.setDate(verwachte.getDate() + gemiddeldInterval);
            verwachte.setHours(0, 0, 0, 0);
            verwachteDatum = verwachte;

            // Bereken dagen sinds verwachte datum
            const dagenSindsVerwachte = Math.floor((vandaag - verwachte) / (1000 * 60 * 60 * 24));

            // Status logica:
            // - Te laat: dagenSindsVerwachte > 0 (elke dag na verwachte datum)
            // - Bijna te laat: dagenSindsVerwachte >= -3 (binnen 3 dagen)
            // - Op schema: dagenSindsVerwachte < -3 (meer dan 3 dagen)

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

        // ===== FILTER: ALTIJD TE LAAT EN BIJNA TE LAAT TONEN =====
        const altijdTonen = dataMetStatus.filter(item => 
            item.status === 'Te laat' || item.status === 'Bijna te laat'
        );

        // Binnen de cutoff: Op schema
        const cutoff = huidigeVoorspellingCutoff || 7;
        const binnenkort = dataMetStatus.filter(item => {
            if (item.status === 'Te laat' || item.status === 'Bijna te laat') return false;
            if (item.status !== 'Op schema') return false;
            if (!item.verwachteDatum) return false;

            const dagenVerschil = Math.ceil((item.verwachteDatum - vandaag) / (1000 * 60 * 60 * 24));
            return dagenVerschil >= 0 && dagenVerschil <= cutoff;
        });

        // Combineer en verwijder dubbelen
        const altijdIds = new Set(altijdTonen.map(i => i.ziekenhuis_id));
        const filteredData = [...altijdTonen];
        for (const item of binnenkort) {
            if (!altijdIds.has(item.ziekenhuis_id)) {
                filteredData.push(item);
            }
        }

        // Sorteer op urgentie
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

    } catch (err) {
        console.error('Fout bij laden analyse:', err);
        analyseLijst.innerHTML = `<p class="error">Fout bij laden: ${err.message}</p>`;
    }
}

/**
 * Update de cutoff waarde en herlaad de analyse
 * @param {number} days - Aantal dagen vooruit kijken
 */
export function setCutoff(days) {
    huidigeVoorspellingCutoff = days;
    laadOphalingAnalyse();
}

/**
 * Haal de huidige cutoff waarde op
 * @returns {number}
 */
export function getCutoff() {
    return huidigeVoorspellingCutoff;
}

// ===== EXPORT =====
export default {
    laadOphalingAnalyse,
    setCutoff,
    getCutoff
};