// ============================================================
// TRACKER DASHBOARD - Chauffeurs volgen (tracker-dashboard.html)
// ============================================================

console.log('🚀 tracker-dashboard.js wordt geladen...');

import { requireAuth } from './core/auth.js';
import { showToast, escapeHtml } from './core/utils.js';
import { supabase } from './core/supabase.js';

console.log('✅ Imports geladen!');

// ===== STATE =====
let map = null;
let markers = {};
let driverInfo = {};
let destinationMarkers = [];
let channel = null;
let isInitialized = false;
let pollInterval = null;
let lastKnownData = {};
let isFirstLoad = true; // Alleen bij eerste keer centreren

// ===== CONSTANTEN =====
const TABLE_NAME = 'locations_test';
const DEFAULT_CENTER = [51.0, 4.0];
const DEFAULT_ZOOM = 12;
const POLL_INTERVAL = 5000; // 5 seconden polling

// ===== DOM ELEMENTEN =====
const trackerCount = document.getElementById('trackerCount');
const trackerStatus = document.getElementById('trackerStatus');
const centerAllBtn = document.getElementById('centerAllBtn');
const refreshBtn = document.getElementById('refreshTrackerBtn');
const restartRealtimeBtn = document.getElementById('restartRealtimeBtn');
const forceUpdateBtn = document.getElementById('forceUpdateBtn');
const driversUl = document.getElementById('trackerDriversUl');

console.log('✅ DOM elementen gevonden');

// ===== KAART INITIALISATIE =====
function initMap() {
    const container = document.getElementById('trackerMap');
    if (!container) {
        console.error('❌ Kaart container niet gevonden');
        return;
    }

    map = L.map('trackerMap').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const customIcon = L.divIcon({
        className: 'tracker-marker',
        html: `<div style="
            width: 28px;
            height: 28px;
            background: #2196F3;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <span style="
                transform: rotate(45deg);
                color: white;
                font-size: 12px;
            ">●</span>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
    });

    map._customIcon = customIcon;

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 500);

    console.log('✅ Kaart geïnitialiseerd');
    return map;
}

// ===== BESTEMMINGEN =====
async function laadBestemmingen() {
    try {
        const vandaag = new Date().toISOString().split('T')[0];
        console.log(`📅 Bestemmingen laden voor: ${vandaag}`);

        const { data: planningen, error } = await supabase
            .from('planningen')
            .select(`
                id,
                adres_id,
                adres:adres_id (id, instelling_naam, straat, postcode, plaats, latitude, longitude)
            `)
            .eq('datum', vandaag)
            .in('status', ['gepland', 'bevestigd']);

        if (error) {
            console.error('❌ Fout bij laden bestemmingen:', error);
            return;
        }

        if (!planningen || planningen.length === 0) {
            console.log('📭 Geen bestemmingen gevonden voor vandaag');
            return;
        }

        console.log(`📍 ${planningen.length} bestemmingen geladen voor vandaag`);
        tekenBestemmingen(planningen);

    } catch (err) {
        console.error('❌ Fout bij laden bestemmingen:', err);
    }
}

function tekenBestemmingen(planningen) {
    destinationMarkers.forEach(marker => {
        if (map) map.removeLayer(marker);
    });
    destinationMarkers = [];

    const destinationIcon = L.divIcon({
        className: 'destination-marker',
        html: `<div style="
            width: 28px;
            height: 28px;
            background: #28a745;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        ">
            🏁
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
    });

    planningen.forEach(planning => {
        const adres = planning.adres;
        if (!adres || !adres.latitude || !adres.longitude) {
            console.warn(`⚠️ Geen coördinaten voor adres: ${adres?.instelling_naam}`);
            return;
        }

        const marker = L.marker([adres.latitude, adres.longitude], {
            icon: destinationIcon
        })
        .addTo(map)
        .bindPopup(`
            <b>📍 ${escapeHtml(adres.instelling_naam)}</b><br>
            ${escapeHtml(adres.straat)}<br>
            ${escapeHtml(adres.postcode)} ${escapeHtml(adres.plaats)}<br>
            🕐 Planning voor vandaag
        `);

        destinationMarkers.push(marker);
    });

    console.log(`✅ ${destinationMarkers.length} bestemmingsmarkers getekend`);
}

// ===== MARKER FUNCTIES =====
function updateMarker(driverId, lat, lng, name = null) {
    if (!map) return;

    const icon = map._customIcon || L.marker();

    if (markers[driverId]) {
        markers[driverId].setLatLng([lat, lng]);
    } else {
        const marker = L.marker([lat, lng], { icon: icon })
            .addTo(map)
            .bindPopup(`
                <b>${escapeHtml(name || driverId)}</b><br>
                📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                🕐 ${new Date().toLocaleTimeString('nl-NL')}
            `);
        markers[driverId] = marker;
    }

    driverInfo[driverId] = {
        name: name || driverId,
        lat: lat,
        lng: lng,
        time: new Date().toLocaleTimeString('nl-NL'),
        timestamp: Date.now()
    };

    updateDriverList();
    updateCount();
}

function removeMarker(driverId) {
    if (markers[driverId]) {
        map.removeLayer(markers[driverId]);
        delete markers[driverId];
    }
    delete driverInfo[driverId];
    updateDriverList();
    updateCount();
}

// ===== UI UPDATE =====
function updateCount() {
    const count = Object.keys(driverInfo).length;
    if (trackerCount) {
        trackerCount.textContent = `${count} chauffeur${count !== 1 ? 's' : ''}`;
    }
}

function updateDriverList() {
    if (!driversUl) return;

    const driverIds = Object.keys(driverInfo);

    if (driverIds.length === 0) {
        driversUl.innerHTML = '<li class="empty-message">Geen chauffeurs actief</li>';
        return;
    }

    driversUl.innerHTML = driverIds.map(id => {
        const info = driverInfo[id];
        return `
            <li>
                <span class="driver-dot"></span>
                <span class="driver-name">${escapeHtml(info.name)}</span>
                <span class="driver-time">${info.time || ''}</span>
                <button class="btn btn-danger btn-small verwijder-chauffeur-btn" 
                        data-driver="${id}" 
                        title="Verwijder chauffeur">
                    ✖
                </button>
            </li>
        `;
    }).join('');

    document.querySelectorAll('.verwijder-chauffeur-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const driverId = this.dataset.driver;
            verwijderChauffeur(driverId);
        });
    });
}

function updateStatus(status, message) {
    if (!trackerStatus) return;
    trackerStatus.textContent = message || status;
    trackerStatus.className = 'badge';

    if (status === 'connected') {
        trackerStatus.classList.add('badge-success');
    } else if (status === 'connecting') {
        trackerStatus.classList.add('badge-warning');
    } else if (status === 'error') {
        trackerStatus.classList.add('badge-danger');
    }
}

// ===== VERWIJDER CHAUFFEUR =====
async function verwijderChauffeur(driverId) {
    if (!driverId) {
        showToast('⚠️ Geen chauffeur ID opgegeven', 'error');
        return;
    }

    if (!confirm(`Weet je zeker dat je chauffeur "${driverId}" wilt verwijderen?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('driver_id', driverId);

        if (error) {
            console.error('❌ Fout bij verwijderen:', error);
            showToast('❌ Fout bij verwijderen: ' + error.message, 'error');
            return;
        }

        if (markers[driverId]) {
            map.removeLayer(markers[driverId]);
            delete markers[driverId];
        }
        delete driverInfo[driverId];

        updateDriverList();
        updateCount();

        await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('driver_id', driverId);

        showToast(`✅ Chauffeur "${driverId}" verwijderd`, 'success');
        console.log(`🗑️ Chauffeur ${driverId} verwijderd`);

    } catch (err) {
        console.error('❌ Fout:', err);
        showToast('❌ Fout: ' + err.message, 'error');
    }
}

// ===== DATA LADEN (POLLING) =====
async function laadBestaandeLocaties() {
    try {
        console.log('📥 Bestaande locaties laden...');

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('last_updated', { ascending: false });

        if (error) {
            console.error('❌ Fout bij laden:', error);
            updateStatus('error', '❌ Fout bij laden');
            return;
        }

        if (data && data.length > 0) {
            const latestByDriver = {};
            data.forEach(row => {
                const id = row.driver_id;
                if (!latestByDriver[id] ||
                    new Date(row.last_updated) > new Date(latestByDriver[id].last_updated)) {
                    latestByDriver[id] = row;
                }
            });

            // Update markers
            Object.keys(latestByDriver).forEach(id => {
                const row = latestByDriver[id];
                if (row.latitude && row.longitude) {
                    updateMarker(
                        row.driver_id,
                        row.latitude,
                        row.longitude,
                        row.driver_name
                    );
                }
            });

            // Verwijder markers die niet meer in de data zitten
            Object.keys(markers).forEach(id => {
                if (!latestByDriver[id]) {
                    removeMarker(id);
                }
            });

            // ===== CENTREER ALLEEN BIJ EERSTE LADING =====
            if (isFirstLoad) {
                const first = Object.values(latestByDriver)[0];
                if (first && map) {
                    map.setView([first.latitude, first.longitude], 13);
                    isFirstLoad = false;
                    console.log('📍 Kaart gecentreerd op eerste chauffeur (eenmalig)');
                }
            }

            console.log(`✅ ${Object.keys(latestByDriver).length} chauffeurs geladen`);
            updateStatus('connected', '✅ Verbonden');
        } else {
            console.log('📭 Geen bestaande locaties gevonden');
            updateStatus('connected', '✅ Verbonden (geen chauffeurs)');
        }
    } catch (err) {
        console.error('❌ Fout bij laden:', err);
        updateStatus('error', '❌ Fout: ' + err.message);
    }
}

// ===== REALTIME LISTENER (FALLBACK) =====
function startRealtimeListener() {
    if (channel) {
        console.log('⚠️ Realtime listener bestaat al, wordt vervangen');
        channel.unsubscribe();
        channel = null;
    }

    console.log('📡 Verbinden met Supabase Realtime (fallback)...');

    channel = supabase
        .channel('locations_test_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: TABLE_NAME
            },
            (payload) => {
                console.log('📩 Realtime event ontvangen:', payload.eventType);

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const data = payload.new;
                    if (data && data.latitude && data.longitude) {
                        updateMarker(
                            data.driver_id,
                            data.latitude,
                            data.longitude,
                            data.driver_name
                        );
                    }
                } else if (payload.eventType === 'DELETE') {
                    const data = payload.old;
                    if (data && data.driver_id) {
                        removeMarker(data.driver_id);
                    }
                }
            }
        )
        .subscribe((status) => {
            console.log('🔗 Realtime status:', status);
        });
}

// ===== POLLING (HOOFDMETHODE) =====
function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    console.log(`🔄 Polling gestart (elke ${POLL_INTERVAL/1000} seconden)`);
    
    // Direct laden
    laadBestaandeLocaties();

    // En daarna elke X seconden
    pollInterval = setInterval(() => {
        laadBestaandeLocaties();
    }, POLL_INTERVAL);
}

// ===== FORCEER REFRESH =====
async function forceRefresh() {
    console.log('🔄 Forceer refresh...');
    showToast('🔄 Vernieuwen...', 'info');

    Object.keys(markers).forEach(id => {
        if (markers[id]) {
            map.removeLayer(markers[id]);
        }
    });
    markers = {};
    driverInfo = {};

    destinationMarkers.forEach(marker => {
        if (map) map.removeLayer(marker);
    });
    destinationMarkers = [];

    // Reset de first load flag zodat het opnieuw centreert
    isFirstLoad = true;
    
    await laadBestaandeLocaties();
    await laadBestemmingen();

    showToast('✅ Kaart vernieuwd', 'success');
}

// ===== AUTO CLEANUP - 4 UUR =====
function startAutoCleanup() {
    console.log('⏰ Auto-cleanup ingesteld op 4 uur');
    
    setInterval(() => {
        const now = Date.now();
        const timeout = 14400000; // 4 uur

        Object.keys(driverInfo).forEach(id => {
            if (now - driverInfo[id].timestamp > timeout) {
                console.log(`⏰ Chauffeur ${id} verwijderd (4 uur inactief)`);
                removeMarker(id);
            }
        });
    }, 60000);
}

// ===== CENTREER =====
function centerOnAllDrivers() {
    if (!map) return;

    const drivers = Object.values(driverInfo);
    if (drivers.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
    }

    if (drivers.length === 1) {
        map.setView([drivers[0].lat, drivers[0].lng], 14);
        return;
    }

    let latSum = 0, lngSum = 0;
    drivers.forEach(d => {
        latSum += d.lat;
        lngSum += d.lng;
    });
    const center = [latSum / drivers.length, lngSum / drivers.length];
    map.setView(center, 12);
}

// ===== RESTART REALTIME =====
function restartRealtime() {
    console.log('🔄 Realtime herstarten...');
    showToast('🔄 Realtime verbinding wordt herstart...', 'info');
    startRealtimeListener();
    setTimeout(() => {
        showToast('✅ Realtime verbinding herstart', 'success');
    }, 1000);
}

// ============================================================
// EXPORTS
// ============================================================
export {
    initMap,
    laadBestaandeLocaties,
    laadBestemmingen,
    forceRefresh,
    restartRealtime,
    centerOnAllDrivers,
    updateMarker,
    removeMarker,
    markers,
    driverInfo,
    channel,
    map
};

window.trackerDashboard = {
    initMap,
    laadBestaandeLocaties,
    laadBestemmingen,
    forceRefresh,
    restartRealtime,
    centerOnAllDrivers,
    updateMarker,
    removeMarker,
    getDriverInfo: () => ({ ...driverInfo }),
    getDriverCount: () => Object.keys(driverInfo).length,
    markers,
    driverInfo,
    channel,
    map
};

console.log('✅ Tracker dashboard exports beschikbaar');

// ============================================================
// INITIALISATIE
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Tracker dashboard initialiseren...');

    const auth = await requireAuth('index.html');
    if (!auth.isAuthenticated) {
        console.warn('⚠️ Niet ingelogd, redirect...');
        return;
    }
    console.log('✅ Ingelogd als:', auth.user?.email);

    initMap();
    await laadBestemmingen();
    
    // Start polling (hoofdmethode)
    startPolling();
    
    // Start Realtime (fallback)
    startRealtimeListener();
    
    // Start cleanup
    startAutoCleanup();

    if (centerAllBtn) {
        centerAllBtn.addEventListener('click', centerOnAllDrivers);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', forceRefresh);
    }

    if (restartRealtimeBtn) {
        restartRealtimeBtn.addEventListener('click', restartRealtime);
    }

    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', function() {
            console.log('📡 Forceer update...');
            forceRefresh();
            showToast('✅ Update geforceerd', 'success');
        });
    }

    console.log('✅ Tracker dashboard geïnitialiseerd!');
});

console.log('✅ tracker-dashboard.js geladen!');