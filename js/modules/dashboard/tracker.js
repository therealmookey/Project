// ============================================================
// MODULE - TRACKER (Realtime chauffeurs volgen)
// ============================================================

console.log('🗺️ Tracker module geladen...');

// Gebruik de globale supabase
const supabase = window.supabase;

// ===== STATE =====
let map = null;
let markers = {};
let driverInfo = {};
let channel = null;
let isInitialized = false;
let onDriverUpdate = null;

// ===== CONSTANTEN =====
const TABLE_NAME = 'locations_test';
const DEFAULT_CENTER = [51.0, 4.0];
const DEFAULT_ZOOM = 12;

// ===== KAART INITIALISATIE =====
export function initTracker(containerId, options = {}) {
    if (isInitialized) {
        console.warn('⚠️ Tracker is al geïnitialiseerd');
        return map;
    }

    const {
        center = DEFAULT_CENTER,
        zoom = DEFAULT_ZOOM,
        onDriverUpdate: callback = null
    } = options;

    onDriverUpdate = callback;

    // Controleer of Leaflet beschikbaar is
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet is niet geladen. Voeg de CDN toe aan dashboard.html');
        return null;
    }

    // Kaart aanmaken
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`❌ Container "${containerId}" niet gevonden`);
        return null;
    }

    map = L.map(containerId).setView(center, zoom);

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Custom marker
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

    // Sla de custom icon op voor later gebruik
    map._customIcon = customIcon;

    isInitialized = true;
    console.log('✅ Tracker geïnitialiseerd');

    // Laad bestaande locaties
    laadBestaandeLocaties();

    // Start realtime listener
    startRealtimeListener();

    // Auto-refresh: verwijder oude chauffeurs
    startAutoCleanup();

    return map;
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
                <b>${name || driverId}</b><br>
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

    if (onDriverUpdate) {
        onDriverUpdate(driverId, driverInfo[driverId]);
    }
}

function removeMarker(driverId) {
    if (markers[driverId]) {
        map.removeLayer(markers[driverId]);
        delete markers[driverId];
    }
    delete driverInfo[driverId];
}

// ===== DATA LADEN =====
async function laadBestaandeLocaties() {
    try {
        console.log('📥 Bestaande locaties laden...');

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('last_updated', { ascending: false });

        if (error) {
            console.error('❌ Fout bij laden:', error);
            return;
        }

        if (data && data.length > 0) {
            // Groepeer per chauffeur (laatste locatie per chauffeur)
            const latestByDriver = {};
            data.forEach(row => {
                const id = row.driver_id;
                if (!latestByDriver[id] ||
                    new Date(row.last_updated) > new Date(latestByDriver[id].last_updated)) {
                    latestByDriver[id] = row;
                }
            });

            let first = null;
            Object.values(latestByDriver).forEach(row => {
                if (row.latitude && row.longitude) {
                    updateMarker(
                        row.driver_id,
                        row.latitude,
                        row.longitude,
                        row.driver_name
                    );
                    if (!first) first = row;
                }
            });

            // Centreer op de eerste chauffeur
            if (first && map) {
                map.setView([first.latitude, first.longitude], 13);
            }

            console.log(`✅ ${Object.keys(latestByDriver).length} chauffeurs geladen`);
        } else {
            console.log('📭 Geen bestaande locaties gevonden');
        }
    } catch (err) {
        console.error('❌ Fout bij laden:', err);
    }
}

// ===== REALTIME LISTENER =====
function startRealtimeListener() {
    if (channel) {
        console.log('⚠️ Realtime listener bestaat al');
        return;
    }

    console.log('📡 Verbinden met Supabase Realtime...');

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
                console.log('📩 Event ontvangen:', payload.eventType);

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

// ===== AUTO CLEANUP =====
function startAutoCleanup() {
    // Chauffeurs die te lang niet geüpdatet zijn verwijderen (2 minuten)
    setInterval(() => {
        const now = Date.now();
        const timeout = 120000; // 2 minuten

        let removed = false;
        Object.keys(driverInfo).forEach(id => {
            if (now - driverInfo[id].timestamp > timeout) {
                console.log(`⏰ Chauffeur ${id} verwijderd (timeout)`);
                removeMarker(id);
                removed = true;
            }
        });
    }, 30000);
}

// ===== PUBLIC FUNCTIES =====
export function getDriverInfo() {
    return { ...driverInfo };
}

export function getDriverCount() {
    return Object.keys(driverInfo).length;
}

export function centerOnDriver(driverId) {
    if (markers[driverId] && map) {
        const pos = markers[driverId].getLatLng();
        map.setView(pos, 14);
        return true;
    }
    return false;
}

export function centerOnAllDrivers() {
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

    // Bereken gemiddelde positie
    let latSum = 0, lngSum = 0;
    drivers.forEach(d => {
        latSum += d.lat;
        lngSum += d.lng;
    });
    const center = [latSum / drivers.length, lngSum / drivers.length];
    map.setView(center, 12);
}

export function destroyTracker() {
    if (channel) {
        channel.unsubscribe();
        channel = null;
    }
    if (map) {
        map.remove();
        map = null;
    }
    markers = {};
    driverInfo = {};
    isInitialized = false;
    console.log('🗺️ Tracker vernietigd');
}

// ===== EXPORT =====
export default {
    initTracker,
    getDriverInfo,
    getDriverCount,
    centerOnDriver,
    centerOnAllDrivers,
    destroyTracker
};