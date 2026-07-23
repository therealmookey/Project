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

console.log('✅ DOM elementen gevonden');

// ===== MODULE 1: KPI DASHBOARD =====
async function laadKPI() {
    console.log('📊 KPI dashboard laden...');
    
    try {
        // Totaal ophalingen
        const { count: totaalOphalingen, error: err1 } = await supabase
            .from('ophaalregistraties')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'ophaling');
        
        if (err1) {
            console.error('❌ Fout bij totaal ophalingen:', err1);
        } else {
            console.log('✅ Totaal ophalingen:', totaalOphalingen);
            if (kpiTotaalOphalingen) kpiTotaalOphalingen.textContent = totaalOphalingen || 0;
        }

        // Totaal gewicht
        const { data: gewichtData, error: err2 } = await supabase
            .from('ophaalregistraties')
            .select('gewicht')
            .eq('type', 'ophaling');
        
        if (err2) {
            console.error('❌ Fout bij totaal gewicht:', err2);
        } else {
            const totaalGewicht = gewichtData?.reduce((sum, r) => sum + (r.gewicht || 0), 0) || 0;
            console.log('✅ Totaal gewicht:', totaalGewicht);
            if (kpiTotaalGewicht) kpiTotaalGewicht.textContent = totaalGewicht.toFixed(0);
            
            const gemiddeldGewicht = totaalOphalingen > 0 ? totaalGewicht / totaalOphalingen : 0;
            console.log('✅ Gemiddeld gewicht:', gemiddeldGewicht);
            if (kpiGemiddeldGewicht) kpiGemiddeldGewicht.textContent = gemiddeldGewicht.toFixed(1);
        }

        // Actieve ziekenhuizen
        const { count: ziekenhuizen, error: err3 } = await supabase
            .from('adressen')
            .select('*', { count: 'exact', head: true });
        
        if (err3) {
            console.error('❌ Fout bij ziekenhuizen:', err3);
        } else {
            console.log('✅ Actieve ziekenhuizen:', ziekenhuizen);
            if (kpiZiekenhuizen) kpiZiekenhuizen.textContent = ziekenhuizen || 0;
        }

        // Ritten deze week
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
        
        if (err4) {
            console.error('❌ Fout bij ritten deze week:', err4);
        } else {
            console.log('✅ Ritten deze week:', rittenWeek);
            if (kpiRittenWeek) kpiRittenWeek.textContent = rittenWeek || 0;
        }

        // Opstarten deze maand
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
        
        if (err5) {
            console.error('❌ Fout bij opstarten deze maand:', err5);
        } else {
            console.log('✅ Opstarten deze maand:', opstartenMaand);
            if (kpiOpstartenMaand) kpiOpstartenMaand.textContent = opstartenMaand || 0;
        }
        
        console.log('✅ KPI dashboard geladen');
    } catch (err) {
        console.error('❌ Fout bij laden KPI:', err);
    }
}

// ===== MODULE 2: TREND CHART =====
async function laadTrendChart() {
    console.log('📈 Trend chart laden...');
    
    try {
        const { data, error } = await supabase
            .from('ophaalregistraties')
            .select('registratiedatum, gewicht')
            .eq('type', 'ophaling')
            .order('registratiedatum', { ascending: true });
        
        if (error) {
            console.error('❌ Fout bij trend chart:', error);
            return;
        }
        
        if (!data || data.length === 0) {
            console.warn('⚠️ Geen data voor trend chart');
            if (trendChartCanvas) {
                trendChartCanvas.parentElement.innerHTML = '<p>Geen data beschikbaar</p>';
            }
            return;
        }

        // Groepeer per maand
        const maanden = {};
        data.forEach(r => {
            const maand = r.registratiedatum.substring(0, 7);
            if (!maanden[maand]) {
                maanden[maand] = { count: 0, gewicht: 0 };
            }
            maanden[maand].count++;
            maanden[maand].gewicht += r.gewicht || 0;
        });

        const labels = Object.keys(maanden).sort();
        const counts = labels.map(m => maanden[m].count);
        const gewichten = labels.map(m => Math.round(maanden[m].gewicht));

        if (!trendChartCanvas) return;
        const ctx = trendChartCanvas.getContext('2d');
        
        if (trendChartInstance) {
            trendChartInstance.destroy();
        }

        const maandNamen = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        
        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(l => {
                    const [year, month] = l.split('-');
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
            .select('instelling_naam, gemiddeld_interval, aantal_ophalingen, status')
            .order('instelling_naam', { ascending: true });
        
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

        // Update count
        const countEl = document.getElementById('frequentieCount');
        if (countEl) {
            countEl.textContent = `${data.length} ziekenhuizen`;
        }

        const labels = data.map(item => item.instelling_naam);
        const intervals = data.map(item => item.gemiddeld_interval || 0);
        const statussen = data.map(item => item.status || 'Geen data');

        const kleuren = statussen.map(status => {
            if (status === 'Te laat') return '#dc3545';
            if (status === 'Bijna te laat') return '#ffc107';
            if (status === 'Onvoldoende data') return '#adb5bd';
            if (status === 'Geen data') return '#e9ecef';
            return '#28a745';
        });

        if (!frequentieChartCanvas) return;
        const ctx = frequentieChartCanvas.getContext('2d');
        
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
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        titleColor: '#fff',
                        bodyColor: '#e0e0e0',
                        cornerRadius: 6,
                        padding: 12,
                        callbacks: {
                            afterBody: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const item = data[index];
                                return [
                                    `Aantal ophalingen: ${item.aantal_ophalingen}`,
                                    `Status: ${item.status || 'Geen data'}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.06)',
                            drawBorder: false
                        },
                        title: {
                            display: true,
                            text: 'Dagen',
                            font: { size: 12 }
                        },
                        ticks: {
                            font: { size: 10 },
                            stepSize: 7,
                            maxTicksLimit: 15
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: { size: 8 },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            callback: function(value, index) {
                                const label = labels[index];
                                if (label && label.length > 35) {
                                    return label.substring(0, 32) + '...';
                                }
                                return label;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                }
            }
        });
        
        // Forceer hertekenen
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

// ===== INITIALISATIE =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Analytics pagina initialiseren...');
    
    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);
    
    // Laad alle modules
    await laadKPI();
    await laadTrendChart();
    await laadTopZiekenhuizen();
    await laadVoorraadWaarschuwingen();
    await laadFrequentieChart();
    await laadActiviteitenLog();
    
    console.log('✅ Analytics pagina geïnitialiseerd!');
});

console.log('✅ analytics.js geladen!');