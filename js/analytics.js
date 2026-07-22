// ===== ANALYTICS FUNCTIES =====

console.log('analytics.js geladen');

let trendChartInstance = null;
let frequentieChartInstance = null;

document.addEventListener('DOMContentLoaded', async function() {
    
    if (!window.supabase) {
        console.error('Supabase niet beschikbaar!');
        return;
    }
    
    // Controleer of de gebruiker is ingelogd en admin is
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    // Check admin status
    const { data: userRollen, error: rolError } = await window.supabase
        .from('gebruikers_rollen')
        .select('rol')
        .eq('user_id', user.id);
    
    if (rolError || !userRollen || userRollen.length === 0 || userRollen[0].rol !== 'admin') {
        alert('Je hebt geen toegang tot deze pagina. Alleen admins kunnen hier komen.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    console.log('✅ Admin toegang voor analytics');
    
    // Laad alle data
    await laadKPI();
    await laadTrendChart();
    await laadTopZiekenhuizen();
    await laadVoorraadWaarschuwingen();
    await laadFrequentieChart();
    await laadActiviteitenLog();
});

// ===== KPI DASHBOARD =====

async function laadKPI() {
    try {
        // Totaal ophalingen
        const { count: totaalOphalingen } = await window.supabase
            .from('ophaalregistraties')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'ophaling');
        
        // Totaal gewicht
        const { data: gewichtData } = await window.supabase
            .from('ophaalregistraties')
            .select('gewicht')
            .eq('type', 'ophaling');
        
        const totaalGewicht = gewichtData?.reduce((sum, r) => sum + (r.gewicht || 0), 0) || 0;
        
        // Gemiddeld gewicht per ophaling
        const gemiddeldGewicht = totaalOphalingen > 0 ? totaalGewicht / totaalOphalingen : 0;
        
        // Actieve ziekenhuizen
        const { count: ziekenhuizen } = await window.supabase
            .from('adressen')
            .select('*', { count: 'exact', head: true });
        
        // Ritten deze week
        const vandaag = new Date();
        const weekStart = new Date(vandaag);
        weekStart.setDate(vandaag.getDate() - vandaag.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEind = new Date(weekStart);
        weekEind.setDate(weekStart.getDate() + 7);
        const weekEindStr = weekEind.toISOString().split('T')[0];
        
        const { count: rittenWeek } = await window.supabase
            .from('planningen')
            .select('*', { count: 'exact', head: true })
            .gte('datum', weekStartStr)
            .lt('datum', weekEindStr);
        
        // Opstarten deze maand
        const maandStart = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
        const maandStartStr = maandStart.toISOString().split('T')[0];
        const maandEind = new Date(vandaag.getFullYear(), vandaag.getMonth() + 1, 0);
        const maandEindStr = maandEind.toISOString().split('T')[0];
        
        const { count: opstartenMaand } = await window.supabase
            .from('ophaalregistraties')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'opstart')
            .gte('registratiedatum', maandStartStr)
            .lte('registratiedatum', maandEindStr);
        
        // Update UI
        document.getElementById('kpiTotaalOphalingen').textContent = totaalOphalingen || 0;
        document.getElementById('kpiTotaalGewicht').textContent = totaalGewicht.toFixed(0);
        document.getElementById('kpiGemiddeldGewicht').textContent = gemiddeldGewicht.toFixed(1);
        document.getElementById('kpiZiekenhuizen').textContent = ziekenhuizen || 0;
        document.getElementById('kpiRittenWeek').textContent = rittenWeek || 0;
        document.getElementById('kpiOpstartenMaand').textContent = opstartenMaand || 0;
        
    } catch (err) {
        console.error('Fout bij laden KPI:', err);
    }
}

// ===== TREND CHART =====

async function laadTrendChart() {
    try {
        const { data, error } = await window.supabase
            .from('ophaalregistraties')
            .select('registratiedatum, gewicht')
            .eq('type', 'ophaling')
            .order('registratiedatum', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            document.getElementById('trendChart').parentElement.innerHTML = '<p>Geen data beschikbaar</p>';
            return;
        }
        
        // Groepeer per maand
        const maanden = {};
        data.forEach(r => {
            const maand = r.registratiedatum.substring(0, 7); // YYYY-MM
            if (!maanden[maand]) {
                maanden[maand] = { count: 0, gewicht: 0 };
            }
            maanden[maand].count++;
            maanden[maand].gewicht += r.gewicht || 0;
        });
        
        const labels = Object.keys(maanden).sort();
        const counts = labels.map(m => maanden[m].count);
        const gewichten = labels.map(m => Math.round(maanden[m].gewicht));
        
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        if (trendChartInstance) {
            trendChartInstance.destroy();
        }
        
        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(l => {
                    const [year, month] = l.split('-');
                    const maandNamen = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
                    return `${maandNamen[parseInt(month) - 1]} ${year}`;
                }),
                datasets: [
                    {
                        label: 'Aantal ophalingen',
                        data: counts,
                        borderColor: '#2c7da0',
                        backgroundColor: 'rgba(44, 125, 160, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Gewicht (kg)',
                        data: gewichten,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Aantal ophalingen',
                            font: { size: 10 }
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: {
                            display: true,
                            text: 'Gewicht (kg)',
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
        
    } catch (err) {
        console.error('Fout bij laden trend chart:', err);
    }
}

// ===== TOP ZIEKENHUIZEN =====

async function laadTopZiekenhuizen() {
    const container = document.getElementById('topZiekenhuizen');
    
    try {
        const { data, error } = await window.supabase
            .from('ophaalregistraties')
            .select(`
                ziekenhuis_id,
                gewicht,
                ziekenhuis:ziekenhuis_id (instelling_naam)
            `)
            .eq('type', 'ophaling');
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p>Geen data beschikbaar</p>';
            return;
        }
        
        // Groepeer per ziekenhuis
        const ziekenhuizen = {};
        data.forEach(r => {
            const naam = r.ziekenhuis?.instelling_naam || 'Onbekend';
            if (!ziekenhuizen[naam]) {
                ziekenhuizen[naam] = { count: 0, gewicht: 0 };
            }
            ziekenhuizen[naam].count++;
            ziekenhuizen[naam].gewicht += r.gewicht || 0;
        });
        
        const sorted = Object.entries(ziekenhuizen)
            .map(([naam, data]) => ({ naam, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        let html = '<ul class="top-list">';
        sorted.forEach((item, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            html += `
                <li class="top-item">
                    <span class="top-rank">${medal}</span>
                    <span class="top-naam">${escapeHtml(item.naam)}</span>
                    <span class="top-count">${item.count} ophalingen</span>
                    <span class="top-weight">${item.gewicht.toFixed(0)} kg</span>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
        
    } catch (err) {
        console.error('Fout bij laden top ziekenhuizen:', err);
        container.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== VOORRAAD WAARSCHUWINGEN =====

async function laadVoorraadWaarschuwingen() {
    const container = document.getElementById('voorraadWaarschuwingen');
    
    try {
        const { data, error } = await window.supabase
            .from('stock_items')
            .select('*')
            .order('aantal', { ascending: true });
        
        if (error) throw error;
        
        const warnings = data ? data.filter(item => item.aantal < item.minimum_stock) : [];
        
        if (!warnings || warnings.length === 0) {
            container.innerHTML = '<p>✅ Alle items zijn op voorraad!</p>';
            return;
        }
        
        let html = '<ul class="warning-list">';
        warnings.forEach(item => {
            const tekort = item.minimum_stock - item.aantal;
            const urgency = tekort > 10 ? '🔴' : tekort > 5 ? '🟡' : '🟠';
            html += `
                <li class="warning-item">
                    <span class="warning-urgency">${urgency}</span>
                    <span class="warning-code">${escapeHtml(item.item_code)}</span>
                    <span class="warning-name">${escapeHtml(item.omschrijving)}</span>
                    <span class="warning-stock">${item.aantal} / ${item.minimum_stock}</span>
                    <span class="warning-tekort">Tekort: ${tekort}</span>
                </li>
            `;
        });
        html += '</ul>';
        container.innerHTML = html;
        
    } catch (err) {
        console.error('Fout bij laden voorraad waarschuwingen:', err);
        container.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== FREQUENTIE CHART =====

async function laadFrequentieChart() {
    try {
        const { data, error } = await window.supabase
            .from('ophaling_analyse')
            .select('instelling_naam, gemiddeld_interval, aantal_ophalingen')
            .gt('aantal_ophalingen', 1)
            .order('gemiddeld_interval', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            document.getElementById('frequentieChart').parentElement.innerHTML = '<p>Geen data beschikbaar</p>';
            return;
        }
        
        const labels = data.map(item => {
            let naam = item.instelling_naam;
            if (naam.length > 20) naam = naam.substring(0, 17) + '...';
            return naam;
        });
        
        const intervals = data.map(item => item.gemiddeld_interval || 0);
        
        const kleuren = intervals.map(interval => {
            if (interval <= 14) return '#28a745';
            if (interval <= 21) return '#ffc107';
            return '#dc3545';
        });
        
        const ctx = document.getElementById('frequentieChart').getContext('2d');
        
        if (frequentieChartInstance) {
            frequentieChartInstance.destroy();
        }
        
        frequentieChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gemiddeld interval (dagen)',
                    data: intervals,
                    backgroundColor: kleuren.map(c => c + 'CC'),
                    borderColor: kleuren,
                    borderWidth: 1.5,
                    borderRadius: 3,
                    barPercentage: 0.6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const item = data[index];
                                return `Aantal ophalingen: ${item.aantal_ophalingen}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Dagen',
                            font: { size: 10 }
                        }
                    },
                    y: {
                        ticks: {
                            font: { size: 9 }
                        }
                    }
                }
            }
        });
        
    } catch (err) {
        console.error('Fout bij laden frequentie chart:', err);
    }
}

// ===== ACTIVITEITENLOG =====

async function laadActiviteitenLog() {
    const container = document.getElementById('activiteitenLog');
    
    try {
        const { data, error } = await window.supabase
            .from('stock_mutaties')
            .select(`
                *,
                item:item_id (item_code, omschrijving)
            `)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p>Geen activiteiten gevonden.</p>';
            return;
        }
        
        let html = '<table class="log-table">';
        html += `
            <thead>
                <tr>
                    <th>Datum</th>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Aantal</th>
                    <th>Reden</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        const typeLabels = {
            'toevoeging': '✅ Toevoeging',
            'afname': '❌ Afname',
            'correctie': '🔄 Correctie'
        };
        
        data.forEach(log => {
            const datum = new Date(log.created_at).toLocaleString('nl-NL');
            const type = typeLabels[log.type] || log.type;
            const itemName = log.item?.item_code ? `${log.item.item_code} - ${log.item.omschrijving}` : 'Onbekend';
            
            html += `
                <tr>
                    <td>${datum}</td>
                    <td>${escapeHtml(itemName)}</td>
                    <td>${type}</td>
                    <td>${log.aantal}</td>
                    <td>${escapeHtml(log.reden || '-')}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (err) {
        console.error('Fout bij laden activiteitenlog:', err);
        container.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}