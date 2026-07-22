// ===== DASHBOARD FUNCTIES =====

let huidigeAgendaDatum = new Date();
let agendaData = [];
let agendaTooltipTimeout = null;

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
});

// ===== OPHALING ANALYSE =====

let huidigeVoorspellingCutoff = 7; // Standaard 7 dagen

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
        
        // Filter op basis van de geselecteerde cutoff
        const cutoff = huidigeVoorspellingCutoff;
        
        // Items die binnen de cutoff vallen
        const binnenkort = data.filter(item => {
            if (!item.verwachte_volgende) return false;
            const verwachteDatum = new Date(item.verwachte_volgende);
            verwachteDatum.setHours(0, 0, 0, 0);
            const dagenVerschil = Math.ceil((verwachteDatum - vandaag) / (1000 * 60 * 60 * 24));
            return dagenVerschil >= 0 && dagenVerschil <= cutoff;
        });
        
        // Ook items die al te laat zijn (altijd tonen)
        const teLaat = data.filter(item => item.status === 'Te laat');
        
        // Combineer en verwijder dubbelen
        const teLatenIds = teLaat.map(i => i.ziekenhuis_id);
        const filteredData = [...teLaat];
        for (const item of binnenkort) {
            if (!teLatenIds.includes(item.ziekenhuis_id)) {
                filteredData.push(item);
            }
        }
        
        // Sorteer op status (Te laat eerst)
        filteredData.sort((a, b) => {
            const statusOrder = {
                'Te laat': 1,
                'Bijna te laat': 2,
                'Binnenkort nodig': 3,
                'Op schema': 4
            };
            const statusA = statusOrder[a.status] || 5;
            const statusB = statusOrder[b.status] || 5;
            if (statusA !== statusB) return statusA - statusB;
            return a.instelling_naam.localeCompare(b.instelling_naam);
        });
        
        if (filteredData.length === 0) {
            analyseLijst.innerHTML = `<p>✅ Alle ziekenhuizen zijn op schema. Er zijn geen ophalingen nodig in de komende ${cutoff} dagen.</p>`;
            return;
        }
        
        let html = `<div class="analyse-totaal">⚠️ ${filteredData.length} ziekenhuis(sen) hebben binnenkort een ophaling nodig (binnen ${cutoff} dagen)</div>`;
        
        for (const item of filteredData) {
            const statusClass = item.status === 'Te laat' ? 'status-danger' : 
                               (item.status === 'Bijna te laat' ? 'status-warning' : 'status-info');
            
            let statusEmoji = '🟢';
            if (item.status === 'Te laat') statusEmoji = '🔴';
            else if (item.status === 'Bijna te laat') statusEmoji = '🟡';
            
            const verwachteDatum = new Date(item.verwachte_volgende);
            verwachteDatum.setHours(0, 0, 0, 0);
            const dagenVerschil = Math.ceil((verwachteDatum - vandaag) / (1000 * 60 * 60 * 24));
            const isBinnenkort = dagenVerschil >= 0 && dagenVerschil <= cutoff;
            
            let dagenText = '';
            if (item.status === 'Te laat') {
                dagenText = `<span class="badge badge-danger">${item.dagen_sinds_laatste} dagen geleden</span>`;
            } else if (isBinnenkort && dagenVerschil >= 0) {
                dagenText = `<span class="badge badge-info">Over ${dagenVerschil} dagen verwacht</span>`;
            }
            
            let extraInfo = '';
            if (item.laatste_gewicht) {
                extraInfo = ` | Laatste: ${item.laatste_gewicht} kg (${item.laatste_tonnen || 1} ton)`;
            }
            
            html += `
                <div class="analyse-item ${statusClass}">
                    <div class="analyse-item-header">
                        <strong>${escapeHtml(item.instelling_naam)}</strong>
                        <span class="analyse-status">${statusEmoji} ${item.status}</span>
                    </div>
                    <div class="analyse-item-details">
                        <div>📍 ${escapeHtml(item.straat)}, ${escapeHtml(item.postcode)} ${escapeHtml(item.plaats)}</div>
                        ${item.contactpersoon_naam ? `<div>👤 ${escapeHtml(item.contactpersoon_naam)} ${item.contactpersoon_email ? `- 📧 ${escapeHtml(item.contactpersoon_email)}` : ''}</div>` : ''}
                        <div class="analyse-stats">
                            <span>📊 Gemiddeld: ${item.gemiddeld_interval} dagen</span>
                            <span>📋 Aantal ophalingen: ${item.aantal_ophalingen}</span>
                            <span>📅 Laatste: ${new Date(item.laatste_ophaling).toLocaleDateString('nl-NL')}${extraInfo}</span>
                            ${item.verwachte_volgende ? `<span>🔮 Verwachte volgende: ${new Date(item.verwachte_volgende).toLocaleDateString('nl-NL')}</span>` : ''}
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

// Filter event listener
document.addEventListener('DOMContentLoaded', function() {
    const filterSelect = document.getElementById('voorspellingFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            huidigeVoorspellingCutoff = parseInt(this.value);
            laadOphalingAnalyse();
        });
    }
});
// ===== GRAFIEK FUNCTIES =====

let intervalChartInstance = null;

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
            return;
        }
        
        // Bereid data voor
        const labels = data.map(item => {
            // Verkort lange namen
            let naam = item.instelling_naam;
            if (naam.length > 20) {
                naam = naam.substring(0, 20) + '...';
            }
            return naam;
        });
        
        const gemiddelden = data.map(item => item.gemiddeld_interval || 0);
        const aantallen = data.map(item => item.aantal_ophalingen || 0);
        const statussen = data.map(item => item.status);
        
        // Kleuren op basis van status
        const kleuren = statussen.map(status => {
            if (status === 'Te laat') return '#dc3545';
            if (status === 'Bijna te laat') return '#ffc107';
            if (status === 'Onvoldoende data') return '#6c757d';
            return '#28a745'; // Op schema
        });
        
        const borderKleuren = kleuren.map(c => c);
        
        // Teken de grafiek
        const ctx = document.getElementById('intervalChart').getContext('2d');
        
        // Vernietig bestaande grafiek als die er is
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
                    backgroundColor: kleuren.map(c => c + '80'), // 50% transparantie
                    borderColor: kleuren,
                    borderWidth: 2,
                    borderRadius: 4,
                    barPercentage: 0.7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12,
                                weight: '500'
                            },
                            padding: 16,
                            generateLabels: function(chart) {
                                return [
                                    { text: '🟢 Op schema', fillStyle: '#28a745', strokeStyle: '#28a745' },
                                    { text: '🟡 Bijna te laat', fillStyle: '#ffc107', strokeStyle: '#ffc107' },
                                    { text: '🔴 Te laat', fillStyle: '#dc3545', strokeStyle: '#dc3545' },
                                    { text: '⚪ Onvoldoende data', fillStyle: '#6c757d', strokeStyle: '#6c757d' }
                                ];
                            }
                        }
                    },
                    tooltip: {
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
                        title: {
                            display: true,
                            text: 'Gemiddeld aantal dagen',
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        },
                        ticks: {
                            stepSize: 7,
                            callback: function(value) {
                                return value + ' dagen';
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 30,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
        
    } catch (err) {
        console.error('Fout bij laden grafiek:', err);
    }
}

// Update de initialisatie
document.addEventListener('DOMContentLoaded', function() {
    checkDashboardAuth();
    
    // Laad grafiek na een korte vertraging (zodat de DOM klaar is)
    setTimeout(() => {
        laadGrafiek();
    }, 500);
    
    // Herlaad grafiek bij filter wijziging
    const filterSelect = document.getElementById('voorspellingFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            huidigeVoorspellingCutoff = parseInt(this.value);
            laadOphalingAnalyse();
            // Grafiek opnieuw laden (data verandert niet, maar we kunnen het doen voor consistentie)
            // laadGrafiek();
        });
    }
});

// Laad grafiek ook na het wisselen van maand in de agenda
// Voeg dit toe aan de bestaande agenda navigatie
function refreshGrafiek() {
    laadGrafiek();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialiseer
document.addEventListener('DOMContentLoaded', function() {
    checkDashboardAuth();
});