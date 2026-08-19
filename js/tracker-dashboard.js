// ===== STATE =====
let map = null;
let markers = {};
let driverInfo = {};
let destinationMarkers = [];
let channel = null;
let isInitialized = false;
let pollInterval = null;

// ===== CONSTANTEN =====
const TABLE_NAME = 'locations_test';
const DEFAULT_CENTER = [51.0, 4.0];
const DEFAULT_ZOOM = 12;
const POLL_INTERVAL = 5000; // 5 seconden

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

    // Gebruik DEFAULT_CENTER voor initiële weergave, maar NOOIT meer automatisch centreren
    map = L.map('trackerMap', {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true
    });

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

    console.log('✅ Kaart geïnitialiseerd (geen automatisch centreren)');
    return map;
}

// ===== BESTEMMINGEN =====
async function laadBestemmingen() {
    // ... (zelfde als voorheen)
}

function tekenBestemmingen(planningen) {
    // ... (zelfde als voorheen)
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
    // ... (zelfde als voorheen)
}

// ===== DATA LADEN (POLLING) - GEEN CENTRERING =====
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

            // ===== GEEN AUTOMATISCH CENTREREN MEER =====
            // Alleen de gebruiker kan centreren via de knop

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

// ===== REALTIME LISTENER =====
function startRealtimeListener() {
    // ... (zelfde als voorheen)
}

// ===== POLLING =====
function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    console.log(`🔄 Polling gestart (elke ${POLL_INTERVAL/1000} seconden)`);
    laadBestaandeLocaties();

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

    await laadBestaandeLocaties();
    await laadBestemmingen();

    showToast('✅ Kaart vernieuwd', 'success');
}

// ===== AUTO CLEANUP =====
function startAutoCleanup() {
    // ... (zelfde als voorheen)
}

// ===== CENTREER ALLE CHAUFFEURS (ALLEEN VIA KNOP) =====
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
    // ... (zelfde als voorheen)
}

// ============================================================
// EXPORTS
// ============================================================
// ... (zelfde als voorheen)

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
    
    startPolling();
    startRealtimeListener();
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