// ============================================================
// MODULE - AGENDA (Dashboard agenda functionaliteit)
// ============================================================

// Gebruik de globale supabase in plaats van import
// omdat de module niet altijd correct wordt geladen
const supabase = window.supabase;

// ===== STATE =====
let agendaData = [];
let huidigeAgendaDatum = new Date();
let agendaTooltipTimeout = null;

// ===== HULPFUNCTIE (fallback) =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== AGENDA FUNCTIES =====

/**
 * Laad de agenda voor de huidige maand
 */
export async function laadAgenda() {
    if (!supabase) {
        console.error('Supabase niet beschikbaar voor agenda');
        return;
    }

    const startDatum = new Date(huidigeAgendaDatum.getFullYear(), huidigeAgendaDatum.getMonth(), 1);
    const eindDatum = new Date(huidigeAgendaDatum.getFullYear(), huidigeAgendaDatum.getMonth() + 1, 0);
    const startStr = startDatum.toISOString().split('T')[0];
    const eindStr = eindDatum.toISOString().split('T')[0];

    try {
        const { data, error } = await supabase
            .from('planningen')
            .select(`
                *,
                adres:adres_id (id, instelling_naam, straat, postcode, plaats, telefoon)
            `)
            .gte('datum', startStr)
            .lte('datum', eindStr)
            .order('datum');

        if (error) throw error;

        agendaData = data || [];
        toonAgenda();
    } catch (err) {
        console.error('Fout bij laden agenda:', err);
        const rittenContainer = document.getElementById('agendaRitten');
        if (rittenContainer) {
            rittenContainer.innerHTML = `<p class="error">Fout bij laden agenda: ${err.message}</p>`;
        }
    }
}

/**
 * Toon de agenda in de UI
 */
export function toonAgenda() {
    const titel = document.getElementById('agendaTitel');
    const dagenContainer = document.getElementById('agendaDagen');
    const rittenContainer = document.getElementById('agendaRitten');

    if (!titel || !dagenContainer) return;

    const jaar = huidigeAgendaDatum.getFullYear();
    const maand = huidigeAgendaDatum.getMonth();
    const maandNamen = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
    titel.textContent = `${maandNamen[maand]} ${jaar}`;

    const eersteDag = new Date(jaar, maand, 1).getDay();
    const dagenInMaand = new Date(jaar, maand + 1, 0).getDate();
    const vandaag = new Date();
    const vandaagStr = vandaag.toISOString().split('T')[0];

    let startOffset = (eersteDag === 0) ? 6 : eersteDag - 1;
    let html = '';

    for (let i = 0; i < startOffset; i++) {
        html += `<div class="agenda-dag leeg"></div>`;
    }

    for (let dag = 1; dag <= dagenInMaand; dag++) {
        const datumStr = `${jaar}-${String(maand + 1).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
        const rittenOpDag = agendaData.filter(r => r.datum === datumStr);
        const heeftRitten = rittenOpDag.length > 0;
        const isVandaag = datumStr === vandaagStr;

        let classNames = 'agenda-dag';
        if (heeftRitten) classNames += ' heeft-ritten';
        if (isVandaag) classNames += ' vandaag';

        let badge = '';
        if (heeftRitten) {
            badge = `<span class="agenda-badge">${rittenOpDag.length}</span>`;
        }

        let tooltipData = '';
        if (heeftRitten) {
            const namen = rittenOpDag.map(r => r.adres?.instelling_naam || 'Onbekend').join(', ');
            tooltipData = ` data-tooltip="${escapeHtml(namen)}"`;
        }

        html += `
            <div class="${classNames}" data-datum="${datumStr}"${tooltipData}>
                ${dag}
                ${badge}
            </div>
        `;
    }

    dagenContainer.innerHTML = html;

    // Event listeners toevoegen
    document.querySelectorAll('.agenda-dag:not(.leeg)').forEach(el => {
        el.addEventListener('mouseenter', function(e) {
            toonTooltip(this, e);
        });
        el.addEventListener('mouseleave', function() {
            verbergTooltip();
        });
        el.addEventListener('mousemove', function(e) {
            verplaatsTooltip(e);
        });
        el.addEventListener('click', function() {
            const datum = this.dataset.datum;
            console.log('Geklikt op dag:', datum);
            toonRittenVoorDag(datum);
        });
    });

    // Selecteer vandaag standaard
    const vandaagEl = document.querySelector(`.agenda-dag[data-datum="${vandaagStr}"]`);
    if (vandaagEl && rittenContainer) {
        vandaagEl.classList.add('geselecteerd');
        setTimeout(() => {
            toonRittenVoorDag(vandaagStr);
        }, 100);
    } else if (rittenContainer) {
        rittenContainer.innerHTML = `
            <div class="agenda-geen-ritten">
                <span>📅</span>
                <p>Selecteer een dag om ritten te bekijken.</p>
            </div>
        `;
    }
}

/**
 * Toon tooltip bij hover over een dag
 */
function toonTooltip(element, event) {
    const tooltip = document.getElementById('agendaTooltip');
    const tooltipText = element.dataset.tooltip;
    if (!tooltip || !tooltipText) return;

    if (agendaTooltipTimeout) {
        clearTimeout(agendaTooltipTimeout);
    }

    agendaTooltipTimeout = setTimeout(() => {
        tooltip.textContent = tooltipText;
        tooltip.style.display = 'block';
        verplaatsTooltip(event);
    }, 400);
}

/**
 * Verplaats tooltip met muis
 */
function verplaatsTooltip(event) {
    const tooltip = document.getElementById('agendaTooltip');
    if (!tooltip || tooltip.style.display === 'none') return;

    const x = event.clientX + 15;
    const y = event.clientY - 10;
    const tooltipWidth = tooltip.offsetWidth || 200;
    const tooltipHeight = tooltip.offsetHeight || 50;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = Math.min(x, windowWidth - tooltipWidth - 10);
    let top = Math.min(y, windowHeight - tooltipHeight - 10);

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

/**
 * Verberg tooltip
 */
function verbergTooltip() {
    if (agendaTooltipTimeout) {
        clearTimeout(agendaTooltipTimeout);
        agendaTooltipTimeout = null;
    }
    const tooltip = document.getElementById('agendaTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

/**
 * Toon ritten voor een specifieke dag
 */
function toonRittenVoorDag(datumStr) {
    const rittenContainer = document.getElementById('agendaRitten');
    const ritten = agendaData.filter(r => r.datum === datumStr);

    if (!rittenContainer) return;

    document.querySelectorAll('.agenda-dag').forEach(el => {
        el.classList.remove('geselecteerd');
    });
    document.querySelectorAll(`.agenda-dag[data-datum="${datumStr}"]`).forEach(el => {
        el.classList.add('geselecteerd');
    });

    if (ritten.length === 0) {
        rittenContainer.innerHTML = `
            <div class="agenda-geen-ritten">
                <span>📅</span>
                <p>Geen ritten op ${new Date(datumStr + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
        `;
        return;
    }

    const adresIds = ritten.map(r => r.adres_id).filter(id => id);
    let adressenMap = {};

    ritten.forEach(rit => {
        if (rit.adres) {
            adressenMap[rit.adres_id] = rit.adres;
        }
    });

    const ontbrekendeIds = adresIds.filter(id => !adressenMap[id]);
    if (ontbrekendeIds.length > 0) {
        supabase
            .from('adressen')
            .select('id, instelling_naam, straat, postcode, plaats, telefoon')
            .in('id', ontbrekendeIds)
            .then(({ data, error }) => {
                if (!error && data) {
                    data.forEach(a => {
                        adressenMap[a.id] = a;
                    });
                }
                renderRittenOverzicht(ritten, adressenMap, datumStr);
            });
    } else {
        renderRittenOverzicht(ritten, adressenMap, datumStr);
    }
}

/**
 * Render het ritten overzicht voor een dag
 */
function renderRittenOverzicht(ritten, adressenMap, datumStr) {
    const rittenContainer = document.getElementById('agendaRitten');
    if (!rittenContainer) return;

    const datumObj = new Date(datumStr + 'T00:00:00');
    const dagVanWeek = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][datumObj.getDay()];
    const datumDisplay = `${dagVanWeek} ${datumObj.getDate()} ${datumObj.toLocaleString('nl-NL', { month: 'long' })} ${datumObj.getFullYear()}`;

    let html = `
        <div class="agenda-overzicht-header">
            <h4>📋 ${datumDisplay}</h4>
            <span class="agenda-overzicht-count">${ritten.length} ritten</span>
        </div>
        <ul class="agenda-ritten-lijst">
    `;

    ritten.sort((a, b) => (a.dag_volgorde || 0) - (b.dag_volgorde || 0));

    ritten.forEach(rit => {
        const adres = adressenMap[rit.adres_id];
        const typeIcon = rit.type === 'ophaling' ? '📦' : '🚚';
        const typeLabel = rit.type === 'ophaling' ? 'Ophaling' : 'Plaatsing';
        const volgorde = rit.dag_volgorde || '-';
        const statusClass = rit.status === 'gepland' ? 'status-gepland' : 
                          (rit.status === 'uitgevoerd' ? 'status-uitgevoerd' : 'status-geannuleerd');
        const statusLabel = rit.status === 'gepland' ? 'Gepland' : 
                          (rit.status === 'uitgevoerd' ? 'Uitgevoerd' : 'Geannuleerd');

        let extraInfo = '';
        if (rit.type === 'ophaling' && rit.aantal_tonnen) {
            extraInfo = `${rit.aantal_tonnen} ton(nen)`;
        } else if (rit.type === 'plaatsing' && rit.aantal_lege_tonnen) {
            extraInfo = `${rit.aantal_lege_tonnen} lege ton(nen)`;
        }

        html += `
            <li class="agenda-rit-item">
                <span class="agenda-rit-volgorde">#${volgorde}</span>
                <span class="agenda-rit-type">${typeIcon} ${typeLabel}</span>
                <span class="agenda-rit-naam">${adres ? escapeHtml(adres.instelling_naam) : 'Onbekend'}</span>
                ${extraInfo ? `<span class="agenda-rit-extra">${extraInfo}</span>` : ''}
                <span class="agenda-rit-status ${statusClass}">${statusLabel}</span>
                ${adres?.telefoon ? `<span class="agenda-rit-telefoon">📞 ${escapeHtml(adres.telefoon)}</span>` : ''}
            </li>
        `;
    });

    html += `</ul>`;
    rittenContainer.innerHTML = html;
}

/**
 * Ga naar de vorige maand
 */
export function vorigeMaand() {
    huidigeAgendaDatum.setMonth(huidigeAgendaDatum.getMonth() - 1);
    laadAgenda();
}

/**
 * Ga naar de volgende maand
 */
export function volgendeMaand() {
    huidigeAgendaDatum.setMonth(huidigeAgendaDatum.getMonth() + 1);
    laadAgenda();
}

/**
 * Ga naar vandaag
 */
export function gaNaarVandaag() {
    huidigeAgendaDatum = new Date();
    laadAgenda();
}

// ===== EXPORT =====
export default {
    laadAgenda,
    toonAgenda,
    vorigeMaand,
    volgendeMaand,
    gaNaarVandaag
};