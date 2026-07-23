// ===== DASHBOARD FUNCTIES =====

let huidigeAgendaDatum = new Date();
let agendaData = [];
let agendaTooltipTimeout = null;
let intervalChartInstance = null;
let huidigeVoorspellingCutoff = 7; // Standaard 7 dagen

async function checkDashboardAuth() {
    if (typeof window.supabase === 'undefined') {
        console.error('Geen Supabase in dashboard');
        window.location.href = 'index.html';
        return;
    }

    const { data: { session }, error } = await window.supabase.auth.getSession();
    
    if (error || !session) {
        console.log('Geen sessie gevonden, terug naar login.');
        window.location.href = 'index.html';
    } else {
        console.log('Sessie is geldig voor:', session.user.email);
        toonGebruikersnaam(session.user.id);
        laadAgenda();
        laadOphalingAnalyse();
        laadGrafiek();
    }
}

function toonGebruikersnaam(userId) {
    const userEmailSpan = document.getElementById('userEmail');
    if (!userEmailSpan) return;
    
    try {
        window.supabase
            .from('gebruikers_rollen')
            .select('gebruikersnaam')
            .eq('user_id', userId)
            .single()
            .then(({ data, error }) => {
                if (error) {
                    console.error('Fout bij ophalen gebruikersnaam:', error);
                    userEmailSpan.textContent = 'Gebruiker';
                    return;
                }
                userEmailSpan.textContent = data?.gebruikersnaam || 'Gebruiker';
            });
    } catch (err) {
        console.error('Fout:', err);
        userEmailSpan.textContent = 'Gebruiker';
    }
}

// ===== AGENDA FUNCTIES =====

async function laadAgenda() {
    const startDatum = new Date(huidigeAgendaDatum.getFullYear(), huidigeAgendaDatum.getMonth(), 1);
    const eindDatum = new Date(huidigeAgendaDatum.getFullYear(), huidigeAgendaDatum.getMonth() + 1, 0);
    
    const startStr = startDatum.toISOString().split('T')[0];
    const eindStr = eindDatum.toISOString().split('T')[0];
    
    try {
        const { data, error } = await window.supabase
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

function toonAgenda() {
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

// ===== DAG OVERZICHT FUNCTIES =====

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
        window.supabase
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

// Agenda navigatie
document.addEventListener('DOMContentLoaded', function() {
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const todayBtn = document.getElementById('todayBtn');
    const statsBtn = document.getElementById('statsBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            huidigeAgendaDatum.setMonth(huidigeAgendaDatum.getMonth() - 1);
            laadAgenda();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            huidigeAgendaDatum.setMonth(huidigeAgendaDatum.getMonth() + 1);
            laadAgenda();
        });
    }
    
    if (todayBtn) {
        todayBtn.addEventListener('click', function() {
            huidigeAgendaDatum = new Date();
            laadAgenda();
        });
    }
    
    if (statsBtn) {
        statsBtn.addEventListener('click', async function() {
            if (typeof window.supabase === 'undefined') {
                alert('Supabase is niet beschikbaar');
                return;
            }
            
            const { count: adresCount } = await window.supabase
                .from('adressen')
                .select('*', { count: 'exact', head: true });
            
            const { count: planningCount } = await window.supabase
                .from('planningen')
                .select('*', { count: 'exact', head: true });
            
            alert(`📊 Statistieken\n\n📍 Aantal adressen: ${adresCount || 0}\n📅 Aantal planningen: ${planningCount || 0}`);
        });
    }
    
    // Filter event listener
    const filterSelect = document.getElementById('voorspellingFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            huidigeVoorspellingCutoff = parseInt(this.value);
            laadOphalingAnalyse();
        });
    }
});

// ===== OPHALING ANALYSE =====

// ===== OPHALING ANALYSE (BIJGEWERKT MET CORRECTE STATUSLOGICA) =====
async function laadOphalingAnalyse() {
    const analyseLijst = document.getElementById('analyseLijst');
    if (!analyseLijst) return;

    analyseLijst.innerHTML = '<p>Bezig met laden...</p>';

    try {
        const { data, error } = await window.supabase
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

        // ===== BEPAAL STATUS PER ZIEKENHUIS MET DE NIEUWE LOGICA =====
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

            // Nieuwe statuslogica:
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
        // Toon altijd: Te laat en Bijna te laat (ongeacht cutoff)
        const altijdTonen = dataMetStatus.filter(item => 
            item.status === 'Te laat' || item.status === 'Bijna te laat'
        );

        // Binnen de cutoff: Op schema (alleen als die binnen de gekozen cutoff vallen)
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

        // Sorteer op urgentie: Te laat > Bijna te laat > Binnenkort > Op schema
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
            // Bepaal de juiste kleurklasse op basis van status
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

            // Toon extra informatie over dagen
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

// ===== GRAFIEK FUNCTIES =====

async function laadGrafiek() {
    try {
        const { data, error } = await window.supabase
            .from('ophaling_analyse')
            .select('instelling_naam, gemiddeld_interval, aantal_ophalingen, status')
            .order('gemiddeld_interval', { ascending: true });
        
        if (error) {
            console.error('Fout bij laden grafiek data:', error);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log('Geen data voor grafiek');
            const container = document.getElementById('grafiekInfo');
            if (container) container.textContent = 'Nog geen data beschikbaar voor grafiek';
            return;
        }
        
        // Update info
        const infoEl = document.getElementById('grafiekInfo');
        if (infoEl) {
            infoEl.textContent = `${data.length} ziekenhuizen - Gemiddeld aantal dagen tussen ophalingen`;
        }
        
        // Bereid data voor
        const labels = data.map(item => {
            let naam = item.instelling_naam;
            if (naam.length > 25) {
                naam = naam.substring(0, 22) + '...';
            }
            return naam;
        });
        
        const gemiddelden = data.map(item => item.gemiddeld_interval || 0);
        const statussen = data.map(item => item.status);
        
        // Kleuren op basis van status
        const kleuren = statussen.map(status => {
            if (status === 'Te laat') return '#dc3545';
            if (status === 'Bijna te laat') return '#ffc107';
            if (status === 'Onvoldoende data') return '#adb5bd';
            return '#28a745';
        });
        
        const ctx = document.getElementById('intervalChart').getContext('2d');
        
        if (intervalChartInstance) {
            intervalChartInstance.destroy();
        }
        
        intervalChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gemiddeld interval (dagen)',
                    data: gemiddelden,
                    backgroundColor: kleuren.map(c => c + 'CC'),
                    borderColor: kleuren,
                    borderWidth: 1.5,
                    borderRadius: 3,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#e0e0e0',
                        cornerRadius: 6,
                        padding: 10,
                        callbacks: {
                            afterBody: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const item = data[index];
                                return [
                                    `Aantal ophalingen: ${item.aantal_ophalingen}`,
                                    `Status: ${item.status}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.06)',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Dagen',
                            font: {
                                size: 11,
                                weight: '500'
                            }
                        },
                        ticks: {
                            font: {
                                size: 10
                            },
                            stepSize: 7,
                            callback: function(value) {
                                return value + 'd';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 30,
                            font: {
                                size: 9
                            }
                        }
                    }
                }
            }
        });
        
        // Voeg legenda toe
        const legendContainer = document.getElementById('grafiekLegend');
        if (legendContainer) {
            const statusColors = {
                'Op schema': '#28a745',
                'Bijna te laat': '#ffc107',
                'Te laat': '#dc3545',
                'Onvoldoende data': '#adb5bd'
            };
            
            let legendHtml = '';
            for (const [status, color] of Object.entries(statusColors)) {
                const komtVoor = data.some(item => item.status === status);
                if (komtVoor) {
                    legendHtml += `
                        <span class="grafiek-legend-item">
                            <span class="dot" style="background:${color}"></span>
                            ${status}
                        </span>
                    `;
                }
            }
            legendContainer.innerHTML = legendHtml;
        }
        
    } catch (err) {
        console.error('Fout bij laden grafiek:', err);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', function() {
    checkDashboardAuth();
});