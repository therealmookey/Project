// ============================================================
// ANALYTICS - Analytics pagina (analytics.html)
// ============================================================

console.log('🚀 analytics.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml, formatDate } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let trendChartInstance = null;
let frequentieChartInstance = null;
let alleOphalingenData = [];
let alleZiekenhuizen = [];
let huidigeFilters = {
    ziekenhuis_id: 'alles',
    periode: 'maandelijks',
    datumVanaf: null,
    datumTot: null
};

// ===== DOM ELEMENTEN =====
const kpiTotaalOphalingen = document.getElementById('kpiTotaalOphalingen');
const kpiTotaalGewicht = document.getElementById('kpiTotaalGewicht');
const kpiGemiddeldGewicht = document.getElementById('kpiGemiddeldGewicht');
const kpiZiekenhuizen = document.getElementById('kpiZiekenhuizen');
const kpiRittenWeek = document.getElementById('kpiRittenWeek');
const kpiOpstartenMaand = document.getElementById('kpiOpstartenMaand');
const trendChartCanvas = document.getElementById('trendChart');
const frequentieChartCanvas = document.getElementById('frequentieChart');
const topZiekenhuizenContainer = document.getElementById('topZiekenhuizen');
const voorraadWaarschuwingenContainer = document.getElementById('voorraadWaarschuwingen');
const activiteitenLogContainer = document.getElementById('activiteitenLog');

// Filter DOM elementen
const analyticsZiekenhuisFilter = document.getElementById('analyticsZiekenhuisFilter');
const analyticsPeriodeFilter = document.getElementById('analyticsPeriodeFilter');
const analyticsDatumVanaf = document.getElementById('analyticsDatumVanaf');
const analyticsDatumTot = document.getElementById('analyticsDatumTot');
const analyticsFilterBtn = document.getElementById('analyticsFilterBtn');
const analyticsResetBtn = document.getElementById('analyticsResetBtn');
const analyticsExportBtn = document.getElementById('analyticsExportBtn');

console.log('✅ DOM elementen gevonden');

// ===== HULPFUNCTIE: LAAD ZIEKENHUIZEN =====
async function laadZiekenhuizen() {
    try {
        const { data, error } = await supabase
            .from('adressen')
            .select('id, instelling_naam')
            .order('instelling_naam');
        
        if (error) throw error;
        
        alleZiekenhuizen = data || [];
        
        if (analyticsZiekenhuisFilter) {
            analyticsZiekenhuisFilter.innerHTML = '<option value="alles">Alle ziekenhuizen</option>';
            alleZiekenhuizen.forEach(zk => {
                const option = document.createElement('option');
                option.value = zk.id;
                option.textContent = zk.instelling_naam;
                analyticsZiekenhuisFilter.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Fout bij laden ziekenhuizen:', err);
    }
}

// ===== HULPFUNCTIE: GROEPEER DATA =====
function groepeerData(data, periode) {
    const grouped = {};
    
    data.forEach(r => {
        let key;
        const date = new Date(r.registratiedatum);
        
        switch(periode) {
            case 'wekelijks':
                const startOfYear = new Date(date.getFullYear(), 0, 1);
                const diff = (date - startOfYear) / (7 * 24 * 60 * 60 * 1000);
                const weekNumber = Math.ceil(diff);
                key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
                break;
            case 'jaarlijks':
                key = `${date.getFullYear()}`;
                break;
            case 'aangepast':
            case 'maandelijks':
            default:
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
        }
        
        if (!grouped[key]) {
            grouped[key] = { count: 0, gewicht: 0 };
        }
        grouped[key].count++;
        grouped[key].gewicht += r.gewicht || 0;
    });
    
    return grouped;
}

// ===== HULPFUNCTIE: LABEL FORMATTER =====
function getLabelFormatter(periode) {
    const maandNamen = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    
    return function(label) {
        if (periode === 'jaarlijks') {
            return label;
        } else if (periode === 'wekelijks') {
            const [year, week] = label.split('-W');
            return `W${week} '${year.slice(2)}`;
        } else {
            const [year, month] = label.split('-');
            return `${maandNamen[parseInt(month) - 1]} ${year}`;
        }
    };
}

// ===== MODULE 1: KPI DASHBOARD =====
async function laadKPI() {
    console.log('📊 KPI dashboard laden...');
    
    try {
        const { count: totaalOphalingen, error: err1 } = await supabase
            .from('ophaalregistraties')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'ophaling');
        
        if (!err1 && kpiTotaalOphalingen) {
            kpiTotaalOphalingen.textContent = totaalOphalingen || 0;
        }

        const { data: gewichtData, error: err2 } = await supabase
            .from('ophaalregistraties')
            .select('gewicht')
            .eq('type', 'ophaling');
        
        if (!err2 && gewichtData) {
            const totaalGewicht = gewichtData.reduce((sum, r) => sum + (r.gewicht || 0), 0);
            const gemiddeldGewicht = totaalOphalingen > 0 ? totaalGewicht / totaalOphalingen : 0;
            if (kpiTotaalGewicht) kpiTotaalGewicht.textContent = totaalGewicht.toFixed(0);
            if (kpiGemiddeldGewicht) kpiGemiddeldGewicht.textContent = gemiddeldGewicht.toFixed(1);
        }

        const { count: ziekenhuizen, error: err3 } = await supabase
            .from('adressen')
            .select('*', { count: 'exact', head: true });
        
        if (!err3 && kpiZiekenhuizen) {
            kpiZiekenhuizen.textContent = ziekenhuizen || 0;
        }

        const vandaag = new Date();
        const weekStart = new Date(vandaag);
        weekStart.setDate(vandaag.getDate() - vandaag.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEind = new Date(weekStart);
        weekEind.setDate(weekStart.getDate() + 7);
        const weekEindStr = weekEind.toISOString().split('T')[0];
        
        const { count: rittenWeek, error: err4 } = await supabase
            .from('planningen')
            .select('*', { count: 'exact', head: true })
            .gte('datum', weekStartStr)
            .lt('datum', weekEindStr);
        
        if (!err4 && kpiRittenWeek) {
            kpiRittenWeek.textContent = rittenWeek || 0;
        }

        const maandStart = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
        const maandStartStr = maandStart.toISOString().split('T')[0];
        const maandEind = new Date(vandaag.getFullYear(), vandaag.getMonth() + 1, 0);
        const maandEindStr = maandEind.toISOString().split('T')[0];
        
        const { count: opstartenMaand, error: err5 } = await supabase
            .from('ophaalregistraties')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'opstart')
            .gte('registratiedatum', maandStartStr)
            .lte('registratiedatum', maandEindStr);
        
        if (!err5 && kpiOpstartenMaand) {
            kpiOpstartenMaand.textContent = opstartenMaand || 0;
        }
        
        console.log('✅ KPI dashboard geladen');
    } catch (err) {
        console.error('❌ Fout bij laden KPI:', err);
    }
}

// ===== MODULE 2: TREND CHART (MET FILTERS) =====
async function laadTrendChart() {
    console.log('📈 Trend chart laden met filters...');
    
    try {
        let query = supabase
            .from('ophaalregistraties')
            .select('registratiedatum, gewicht, ziekenhuis_id, ziekenhuis:ziekenhuis_id (instelling_naam)')
            .eq('type', 'ophaling')
            .order('registratiedatum', { ascending: true });
        
        if (huidigeFilters.ziekenhuis_id && huidigeFilters.ziekenhuis_id !== 'alles') {
            query = query.eq('ziekenhuis_id', parseInt(huidigeFilters.ziekenhuis_id));
        }
        
        if (huidigeFilters.datumVanaf) {
            query = query.gte('registratiedatum', huidigeFilters.datumVanaf);
        }
        if (huidigeFilters.datumTot) {
            query = query.lte('registratiedatum', huidigeFilters.datumTot);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Fout bij trend chart:', error);
            return;
        }
        
        alleOphalingenData = data || [];
        
        if (!data || data.length === 0) {
            if (trendChartCanvas) {
                trendChartCanvas.parentElement.innerHTML = '<p>Geen data beschikbaar voor deze filters</p>';
            }
            return;
        }

        const grouped = groepeerData(data, huidigeFilters.periode);
        
        const labels = Object.keys(grouped).sort();
        const counts = labels.map(l => grouped[l].count);
        const gewichten = labels.map(l => Math.round(grouped[l].gewicht));
        
        // Bepaal of er een specifiek ziekenhuis is geselecteerd
        const isAlleZiekenhuizen = !huidigeFilters.ziekenhuis_id || huidigeFilters.ziekenhuis_id === 'alles';
        const ziekenhuisNaam = data[0]?.ziekenhuis?.instelling_naam || '';
        const ziekenhuisLabel = isAlleZiekenhuizen ? '' : ` - ${ziekenhuisNaam}`;

        if (!trendChartCanvas) return;
        const ctx = trendChartCanvas.getContext('2d');
        
        if (trendChartInstance) {
            trendChartInstance.destroy();
        }

        const labelFormatter = getLabelFormatter(huidigeFilters.periode);
        
        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(labelFormatter),
                datasets: [
                    {
                        label: `Aantal ophalingen${ziekenhuisLabel}`,
                        data: counts,
                        borderColor: '#2c7da0',
                        backgroundColor: 'rgba(44, 125, 160, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: `Gewicht (kg)${ziekenhuisLabel}`,
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
                        labels: { font: { size: 11 } }
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
        
        console.log('✅ Trend chart geladen');
    } catch (err) {
        console.error('❌ Fout bij laden trend chart:', err);
    }
}

// ===== MODULE 3: TOP ZIEKENHUIZEN =====
async function laadTopZiekenhuizen() {
    console.log('🏥 Top ziekenhuizen laden...');
    
    if (!topZiekenhuizenContainer) return;
    
    try {
        const { data, error } = await supabase
            .from('ophaalregistraties')
            .select(`
                ziekenhuis_id,
                gewicht,
                ziekenhuis:ziekenhuis_id (instelling_naam)
            `)
            .eq('type', 'ophaling');
        
        if (error) {
            console.error('❌ Fout bij top ziekenhuizen:', error);
            return;
        }
        
        if (!data || data.length === 0) {
            topZiekenhuizenContainer.innerHTML = '<p>Geen data beschikbaar</p>';
            return;
        }

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
        
        topZiekenhuizenContainer.innerHTML = html;
        console.log('✅ Top ziekenhuizen geladen');
    } catch (err) {
        console.error('❌ Fout bij laden top ziekenhuizen:', err);
        topZiekenhuizenContainer.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== MODULE 4: VOORRAAD WAARSCHUWINGEN =====
async function laadVoorraadWaarschuwingen() {
    console.log('⚠️ Voorraad waarschuwingen laden...');
    
    if (!voorraadWaarschuwingenContainer) return;
    
    try {
        const { data, error } = await supabase
            .from('stock_items')
            .select('*')
            .order('aantal', { ascending: true });
        
        if (error) {
            console.error('❌ Fout bij voorraad waarschuwingen:', error);
            return;
        }
        
        const warnings = data ? data.filter(item => item.aantal < item.minimum_stock) : [];
        
        if (!warnings || warnings.length === 0) {
            voorraadWaarschuwingenContainer.innerHTML = '<p>✅ Alle items zijn op voorraad!</p>';
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
        
        voorraadWaarschuwingenContainer.innerHTML = html;
        console.log('✅ Voorraad waarschuwingen geladen');
    } catch (err) {
        console.error('❌ Fout bij laden voorraad waarschuwingen:', err);
        voorraadWaarschuwingenContainer.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== MODULE 5: FREQUENTIE CHART =====
async function laadFrequentieChart() {
    console.log('📊 Frequentie chart laden...');
    
    try {
        const { data, error } = await supabase
            .from('ophaling_analyse')
            .select('instelling_naam, gemiddeld_interval, aantal_ophalingen')
            .order('gemiddeld_interval', { ascending: true });
        
        if (error) {
            console.error('❌ Fout bij frequentie chart:', error);
            return;
        }
        
        if (!data || data.length === 0) {
            if (frequentieChartCanvas) {
                frequentieChartCanvas.parentElement.innerHTML = '<p>Geen data beschikbaar</p>';
            }
            return;
        }

        const countEl = document.getElementById('frequentieCount');
        if (countEl) {
            countEl.textContent = `${data.length} ziekenhuizen`;
        }

        const labels = data.map(item => item.instelling_naam || 'Onbekend');
        const intervals = data.map(item => item.gemiddeld_interval || 0);

        const basisKleur = '#2c7da0';
        const backgroundColor = intervals.map(() => basisKleur + 'CC');
        const borderColor = intervals.map(() => basisKleur);

        if (!frequentieChartCanvas) return;
        const ctx = frequentieChartCanvas.getContext('2d');
        
        if (frequentieChartInstance) {
            frequentieChartInstance.destroy();
        }

        const container = frequentieChartCanvas.parentElement;
        if (container) {
            container.style.height = Math.max(400, data.length * 35) + 'px';
            container.style.minHeight = '400px';
        }

        frequentieChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gemiddeld interval (dagen)',
                    data: intervals,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.8,
                    categoryPercentage: 0.95
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleColor: '#fff',
                        bodyColor: '#e0e0e0',
                        cornerRadius: 6,
                        padding: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        callbacks: {
                            afterBody: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const item = data[index];
                                return [
                                    `Aantal ophalingen: ${item.aantal_ophalingen || 0}`,
                                    `Gemiddeld interval: ${item.gemiddeld_interval || 0} dagen`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.06)', drawBorder: false },
                        title: {
                            display: true,
                            text: 'Dagen',
                            font: { size: 14, weight: 'bold' }
                        },
                        ticks: {
                            font: { size: 13 },
                            stepSize: 7,
                            maxTicksLimit: 15
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 13, weight: '400' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 15,
                        bottom: 15,
                        left: 10,
                        right: 10
                    }
                }
            }
        });
        
        setTimeout(() => {
            if (frequentieChartInstance) {
                frequentieChartInstance.resize();
            }
        }, 100);
        
        console.log('✅ Frequentie chart geladen');
    } catch (err) {
        console.error('❌ Fout bij laden frequentie chart:', err);
    }
}

// ===== MODULE 6: ACTIVITEITENLOG =====
async function laadActiviteitenLog() {
    console.log('📋 Activiteitenlog laden...');
    
    if (!activiteitenLogContainer) return;
    
    try {
        const logs = await haalLogs(100);
        
        if (!logs || logs.length === 0) {
            activiteitenLogContainer.innerHTML = '<p>Geen activiteiten gevonden.</p>';
            return;
        }

        let html = '<table class="log-table">';
        html += `
            <thead>
                <tr>
                    <th>Datum</th>
                    <th>Gebruiker</th>
                    <th>Module</th>
                    <th>Actie</th>
                    <th>Entity</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        const actieIcons = {
            'toegevoegd': '➕',
            'bijgewerkt': '✏️',
            'verwijderd': '🗑️',
            'voorraad aangepast': '📦',
            'ingelogd': '🔐',
            'uitgelogd': '🚪'
        };
        
        const moduleIcons = {
            'adressen': '📍',
            'stock': '📦',
            'planning': '📅',
            'gebruikers': '👤',
            'registraties': '📋',
            'admin': '👑'
        };

        logs.forEach(log => {
            const datum = new Date(log.created_at).toLocaleString('nl-NL');
            const actieIcon = actieIcons[log.actie] || '📌';
            const moduleIcon = moduleIcons[log.module] || '📂';
            const gebruiker = log.user?.gebruikersnaam || log.gebruikersnaam || 'Onbekend';
            
            let detailsHtml = '-';
            if (log.details) {
                try {
                    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                    detailsHtml = Object.entries(details)
                        .filter(([key]) => !['user_id', 'created_at', 'id'].includes(key))
                        .map(([key, value]) => {
                            if (typeof value === 'object') return `${key}: ${JSON.stringify(value).substring(0, 30)}...`;
                            return `${key}: ${value}`;
                        })
                        .join(', ');
                    if (detailsHtml.length > 100) detailsHtml = detailsHtml.substring(0, 100) + '...';
                } catch(e) {
                    detailsHtml = String(log.details).substring(0, 100);
                }
            }
            
            const entityDisplay = log.entity_naam || log.entity_id || '-';
            
            html += `
                <tr>
                    <td style="font-size:0.8rem;">${datum}</td>
                    <td><strong>${escapeHtml(gebruiker)}</strong></td>
                    <td>${moduleIcon} ${escapeHtml(log.module)}</td>
                    <td>${actieIcon} ${escapeHtml(log.actie)}</td>
                    <td>${escapeHtml(entityDisplay)}</td>
                    <td style="font-size:0.75rem;color:#6c757d;">${escapeHtml(detailsHtml)}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        activiteitenLogContainer.innerHTML = html;
        console.log('✅ Activiteitenlog geladen');
    } catch (err) {
        console.error('❌ Fout bij laden activiteitenlog:', err);
        activiteitenLogContainer.innerHTML = `<p class="error">Fout: ${err.message}</p>`;
    }
}

// ===== HULPFUNCTIE: LOGS OPHALEN =====
async function haalLogs(limit = 100) {
    try {
        const { data, error } = await supabase
            .from('activiteitenlog')
            .select(`
                *,
                user:user_id (gebruikersnaam)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('❌ Fout bij ophalen logs:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('❌ Fout bij ophalen logs:', err);
        return [];
    }
}

// ===== HULPFUNCTIE: LOG ACTIE =====
async function logActie(actie, module, entityId = null, entityNaam = null, details = null) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const logData = {
            user_id: user.id,
            actie: actie,
            module: module,
            entity_id: entityId ? String(entityId) : null,
            entity_naam: entityNaam,
            details: details ? JSON.stringify(details) : null
        };

        await supabase
            .from('activiteitenlog')
            .insert([logData]);
    } catch (err) {
        console.warn('Fout bij loggen:', err);
    }
}

// ===== EXPORT EXCEL =====
async function exportExcel() {
    if (!alleOphalingenData || alleOphalingenData.length === 0) {
        showToast('⚠️ Geen data om te exporteren', 'error');
        return;
    }
    
    try {
        if (typeof XLSX === 'undefined') {
            showToast('⚠️ Excel bibliotheek niet geladen. Vernieuw de pagina.', 'error');
            return;
        }
        
        showToast('📊 Excel wordt voorbereid...', 'info');
        
        const ziekenhuisNaam = alleOphalingenData[0]?.ziekenhuis?.instelling_naam || 'Alle ziekenhuizen';
        const periodeLabel = {
            'wekelijks': 'Wekelijks',
            'maandelijks': 'Maandelijks',
            'jaarlijks': 'Jaarlijks',
            'aangepast': 'Aangepaste periode'
        }[huidigeFilters.periode] || 'Maandelijks';
        
        const grouped = groepeerData(alleOphalingenData, huidigeFilters.periode);
        const labels = Object.keys(grouped).sort();
        const labelFormatter = getLabelFormatter(huidigeFilters.periode);
        
        const excelData = labels.map(label => ({
            'Periode': labelFormatter(label),
            'Aantal ophalingen': grouped[label].count,
            'Totaal gewicht (kg)': grouped[label].gewicht.toFixed(1),
            'Gemiddeld gewicht (kg)': (grouped[label].count > 0 ? (grouped[label].gewicht / grouped[label].count).toFixed(1) : 0)
        }));
        
        const totalCount = excelData.reduce((sum, d) => sum + d['Aantal ophalingen'], 0);
        const totalWeight = excelData.reduce((sum, d) => sum + parseFloat(d['Totaal gewicht (kg)']), 0);
        const avgWeight = totalCount > 0 ? (totalWeight / totalCount).toFixed(1) : 0;
        
        const summaryData = [
            { 'Periode': '📊 SAMENVATTING', 'Aantal ophalingen': '', 'Totaal gewicht (kg)': '', 'Gemiddeld gewicht (kg)': '' },
            { 'Periode': `Ziekenhuis: ${ziekenhuisNaam}`, 'Aantal ophalingen': '', 'Totaal gewicht (kg)': '', 'Gemiddeld gewicht (kg)': '' },
            { 'Periode': `Periode: ${periodeLabel}`, 'Aantal ophalingen': '', 'Totaal gewicht (kg)': '', 'Gemiddeld gewicht (kg)': '' },
            { 'Periode': 'TOTAAL', 'Aantal ophalingen': totalCount, 'Totaal gewicht (kg)': totalWeight.toFixed(1), 'Gemiddeld gewicht (kg)': avgWeight },
            { 'Periode': '', 'Aantal ophalingen': '', 'Totaal gewicht (kg)': '', 'Gemiddeld gewicht (kg)': '' },
            { 'Periode': '📋 DETAILS PER PERIODE', 'Aantal ophalingen': '', 'Totaal gewicht (kg)': '', 'Gemiddeld gewicht (kg)': '' }
        ];
        
        const finalData = [...summaryData, ...excelData];
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(finalData);
        
        ws['!cols'] = [
            { wch: 25 },
            { wch: 18 },
            { wch: 20 },
            { wch: 22 }
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Ophalingen Trend');
        
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `ophalingen_trend_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('✅ Excel export succesvol!', 'success');
    } catch (err) {
        console.error('Fout bij Excel export:', err);
        showToast('❌ Fout bij Excel export: ' + err.message, 'error');
    }
}

// ===== FILTER FUNCTIES =====
function applyFilters() {
    if (analyticsZiekenhuisFilter) {
        huidigeFilters.ziekenhuis_id = analyticsZiekenhuisFilter.value;
    }
    
    if (analyticsPeriodeFilter) {
        huidigeFilters.periode = analyticsPeriodeFilter.value;
    }
    
    if (huidigeFilters.periode === 'aangepast') {
        huidigeFilters.datumVanaf = analyticsDatumVanaf?.value || null;
        huidigeFilters.datumTot = analyticsDatumTot?.value || null;
    } else {
        huidigeFilters.datumVanaf = null;
        huidigeFilters.datumTot = null;
    }
    
    laadTrendChart();
}

function resetFilters() {
    if (analyticsZiekenhuisFilter) analyticsZiekenhuisFilter.value = 'alles';
    if (analyticsPeriodeFilter) analyticsPeriodeFilter.value = 'maandelijks';
    if (analyticsDatumVanaf) analyticsDatumVanaf.value = '';
    if (analyticsDatumTot) analyticsDatumTot.value = '';
    
    huidigeFilters = {
        ziekenhuis_id: 'alles',
        periode: 'maandelijks',
        datumVanaf: null,
        datumTot: null
    };
    
    document.getElementById('analyticsDatumVanafGroup').style.display = 'none';
    document.getElementById('analyticsDatumTotGroup').style.display = 'none';
    
    laadTrendChart();
}

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Analytics pagina initialiseren...');
    
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    await laadZiekenhuizen();
    
    await laadKPI();
    await laadTrendChart();
    await laadTopZiekenhuizen();
    await laadVoorraadWaarschuwingen();
    await laadFrequentieChart();
    await laadActiviteitenLog();
    
    if (analyticsPeriodeFilter) {
        analyticsPeriodeFilter.addEventListener('change', function() {
            const isAangepast = this.value === 'aangepast';
            document.getElementById('analyticsDatumVanafGroup').style.display = isAangepast ? 'block' : 'none';
            document.getElementById('analyticsDatumTotGroup').style.display = isAangepast ? 'block' : 'none';
        });
    }
    
    if (analyticsFilterBtn) {
        analyticsFilterBtn.addEventListener('click', applyFilters);
    }
    
    if (analyticsResetBtn) {
        analyticsResetBtn.addEventListener('click', resetFilters);
    }
    
    if (analyticsExportBtn) {
        analyticsExportBtn.addEventListener('click', exportExcel);
    }
    
    if (analyticsDatumVanaf) {
        analyticsDatumVanaf.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (analyticsFilterBtn) analyticsFilterBtn.click();
            }
        });
    }
    
    if (analyticsDatumTot) {
        analyticsDatumTot.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (analyticsFilterBtn) analyticsFilterBtn.click();
            }
        });
    }
    
    console.log('✅ Analytics pagina geïnitialiseerd!');
});

console.log('✅ analytics.js geladen!');