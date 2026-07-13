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
    
    // Verwijder oude event listeners door nieuwe toe te voegen
    document.querySelectorAll('.agenda-dag:not(.leeg)').forEach(el => {
        // Mouse events voor tooltip
        el.addEventListener('mouseenter', function(e) {
            toonTooltip(this, e);
        });
        el.addEventListener('mouseleave', function() {
            verbergTooltip();
        });
        el.addEventListener('mousemove', function(e) {
            verplaatsTooltip(e);
        });
        
        // Click event - gebruik een functie die de datum doorgeeft
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
        // Wacht even zodat de DOM klaar is
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
    
    // Markeer de geselecteerde dag
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
    
    // Haal adres info op voor de ritten
    const adresIds = ritten.map(r => r.adres_id).filter(id => id);
    let adressenMap = {};
    
    // Gebruik de al beschikbare adres data als die er is
    ritten.forEach(rit => {
        if (rit.adres) {
            adressenMap[rit.adres_id] = rit.adres;
        }
    });
    
    // Als er nog ontbrekende adressen zijn, haal ze op
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
        
        const binnenkort = data.filter(item => {
            if (!item.verwachte_volgende) return false;
            const verwachteDatum = new Date(item.verwachte_volgende);
            verwachteDatum.setHours(0, 0, 0, 0);
            const dagenVerschil = Math.ceil((verwachteDatum - vandaag) / (1000 * 60 * 60 * 24));
            return dagenVerschil >= 0 && dagenVerschil <= 5;
        });
        
        const teLaat = data.filter(item => item.status === 'Te laat');
        
        const teLatenIds = teLaat.map(i => i.ziekenhuis_id);
        const filteredData = [...teLaat];
        for (const item of binnenkort) {
            if (!teLatenIds.includes(item.ziekenhuis_id)) {
                filteredData.push(item);
            }
        }
        
        filteredData.sort((a, b) => {
            if (a.status === 'Te laat' && b.status !== 'Te laat') return -1;
            if (a.status !== 'Te laat' && b.status === 'Te laat') return 1;
            return a.instelling_naam.localeCompare(b.instelling_naam);
        });
        
        if (filteredData.length === 0) {
            analyseLijst.innerHTML = '<p>✅ Alle ziekenhuizen zijn op schema. Er zijn geen ophalingen nodig in de komende 5 dagen.</p>';
            return;
        }
        
        let html = `<div class="analyse-totaal">⚠️ ${filteredData.length} ziekenhuis(sen) hebben binnenkort een ophaling nodig</div>`;
        
        for (const item of filteredData) {
            const statusClass = item.status === 'Te laat' ? 'status-danger' : 
                               (item.status === 'Bijna te laat' ? 'status-warning' : 'status-info');
            
            let statusEmoji = '🟢';
            if (item.status === 'Te laat') statusEmoji = '🔴';
            else if (item.status === 'Bijna te laat') statusEmoji = '🟡';
            
            const verwachteDatum = new Date(item.verwachte_volgende);
            verwachteDatum.setHours(0, 0, 0, 0);
            const dagenVerschil = Math.ceil((verwachteDatum - vandaag) / (1000 * 60 * 60 * 24));
            const isBinnenkort = dagenVerschil >= 0 && dagenVerschil <= 5;
            
            let dagenText = '';
            if (item.status === 'Te laat') {
                dagenText = `<span class="badge badge-danger">${item.dagen_sinds_laatste} dagen geleden</span>`;
            } else if (isBinnenkort) {
                dagenText = `<span class="badge badge-info">Over ${dagenVerschil} dagen verwacht</span>`;
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
                            <span>📅 Laatste: ${new Date(item.laatste_ophaling).toLocaleDateString('nl-NL')}</span>
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