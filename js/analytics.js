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
        
        // Vul de filter select
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
        // Bouw de query
        let query = supabase
            .from('ophaalregistraties')
            .select('registratiedatum, gewicht, ziekenhuis_id, ziekenhuis:ziekenhuis_id (instelling_naam)')
            .eq('type', 'ophaling')
            .order('registratiedatum', { ascending: true });
        
        // Ziekenhuis filter
        if (huidigeFilters.ziekenhuis_id && huidigeFilters.ziekenhuis_id !== 'alles') {
            query = query.eq('ziekenhuis_id', parseInt(huidigeFilters.ziekenhuis_id));
        }
        
        // Datum filters
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

        // Groepeer op basis van de gekozen periode
        const grouped = groepeerData(data, huidigeFilters.periode);
        
        const labels = Object.keys(grouped).sort();
        const counts = labels.map(l => grouped[l].count);
        const gewichten = labels.map(l => Math.round(grouped[l].gewicht));
        const ziekenhuisNaam = data[0]?.ziekenhuis?.instelling_naam || 'Alle ziekenhuizen';

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
                        label: `Aantal ophalingen - ${ziekenhuisNaam}`,
                        data: counts,
                        borderColor: '#2c7da0',
                        backgroundColor: 'rgba(44, 125, 160, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: `Gewicht (kg) - ${ziekenhuisNaam}`,
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
        
        console.log('✅ Trend chart geladen');
    } catch (err) {
        console.error('❌ Fout bij laden trend chart:', err);
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
                // Bepaal weeknummer
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

// ===== MODULE 3: TOP ZIEKENHUIZEN =====
async function laadTopZiekenhuizen() {
    // ... blijft hetzelfde ...
}

// ===== MODULE 4: VOORRAAD WAARSCHUWINGEN =====
async function laadVoorraadWaarschuwingen() {
    // ... blijft hetzelfde ...
}

// ===== MODULE 5: FREQUENTIE CHART =====
async function laadFrequentieChart() {
    // ... blijft hetzelfde ...
}

// ===== MODULE 6: ACTIVITEITENLOG =====
async function laadActiviteitenLog() {
    // ... blijft hetzelfde ...
}

// ===== HULPFUNCTIES VOOR LOGS =====
async function haalLogs(limit = 100) {
    // ... blijft hetzelfde ...
}

async function logActie(actie, module, entityId = null, entityNaam = null, details = null) {
    // ... blijft hetzelfde ...
}

// ===== EXPORT EXCEL =====
async function exportExcel() {
    if (!alleOphalingenData || alleOphalingenData.length === 0) {
        showToast('⚠️ Geen data om te exporteren', 'error');
        return;
    }
    
    try {
        showToast('📊 Excel wordt voorbereid...', 'info');
        
        const ziekenhuisNaam = alleOphalingenData[0]?.ziekenhuis?.instelling_naam || 'Alle ziekenhuizen';
        const periodeLabel = {
            'wekelijks': 'Wekelijks',
            'maandelijks': 'Maandelijks',
            'jaarlijks': 'Jaarlijks',
            'aangepast': 'Aangepaste periode'
        }[huidigeFilters.periode] || 'Maandelijks';
        
        // Groepeer data voor export
        const grouped = groepeerData(alleOphalingenData, huidigeFilters.periode);
        const labels = Object.keys(grouped).sort();
        const labelFormatter = getLabelFormatter(huidigeFilters.periode);
        
        const excelData = labels.map(label => ({
            'Periode': labelFormatter(label),
            'Aantal ophalingen': grouped[label].count,
            'Totaal gewicht (kg)': grouped[label].gewicht.toFixed(1),
            'Gemiddeld gewicht (kg)': (grouped[label].count > 0 ? (grouped[label].gewicht / grouped[label].count).toFixed(1) : 0)
        }));
        
        // Voeg een samenvatting toe
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
        
        // Kolombreedtes instellen
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
    // Ziekenhuis filter
    if (analyticsZiekenhuisFilter) {
        huidigeFilters.ziekenhuis_id = analyticsZiekenhuisFilter.value;
    }
    
    // Periode filter
    if (analyticsPeriodeFilter) {
        huidigeFilters.periode = analyticsPeriodeFilter.value;
    }
    
    // Datum filters (alleen bij aangepaste periode)
    if (huidigeFilters.periode === 'aangepast') {
        huidigeFilters.datumVanaf = analyticsDatumVanaf?.value || null;
        huidigeFilters.datumTot = analyticsDatumTot?.value || null;
    } else {
        huidigeFilters.datumVanaf = null;
        huidigeFilters.datumTot = null;
    }
    
    // Herlaad de grafiek
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
    
    // Verberg datum velden
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
    
    // Laad ziekenhuizen
    await laadZiekenhuizen();
    
    // Laad alle modules
    await laadKPI();
    await laadTrendChart();
    await laadTopZiekenhuizen();
    await laadVoorraadWaarschuwingen();
    await laadFrequentieChart();
    await laadActiviteitenLog();
    
    // ===== FILTER EVENT LISTENERS =====
    
    // Periode filter toont/verbergt datum velden
    if (analyticsPeriodeFilter) {
        analyticsPeriodeFilter.addEventListener('change', function() {
            const isAangepast = this.value === 'aangepast';
            document.getElementById('analyticsDatumVanafGroup').style.display = isAangepast ? 'block' : 'none';
            document.getElementById('analyticsDatumTotGroup').style.display = isAangepast ? 'block' : 'none';
        });
    }
    
    // Filter knop
    if (analyticsFilterBtn) {
        analyticsFilterBtn.addEventListener('click', applyFilters);
    }
    
    // Reset knop
    if (analyticsResetBtn) {
        analyticsResetBtn.addEventListener('click', resetFilters);
    }
    
    // Export knop
    if (analyticsExportBtn) {
        analyticsExportBtn.addEventListener('click', exportExcel);
    }
    
    // Enter toets op datum velden
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