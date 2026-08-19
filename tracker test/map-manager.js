// map-manager.js
// Dit bestand beheert de kaart en markers

import { subscribeToLocations } from './supabase-client.js';

let map = null;
const markers = {};
const driverInfo = {};
let onDriverUpdate = null;

export function initMap(containerId, options = {}) {
    const {
        center = [51.0, 4.0],
        zoom = 12,
        onDriverUpdate: callback = null
    } = options;

    onDriverUpdate = callback;

    map = L.map(containerId).setView(center, zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    return map;
}

export function updateMarker(driverId, lat, lng, name = null) {
    if (!map) return;

    if (markers[driverId]) {
        markers[driverId].setLatLng([lat, lng]);
    } else {
        const marker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`<b>${name || driverId}</b><br>${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        markers[driverId] = marker;
    }

    driverInfo[driverId] = {
        name: name || driverId,
        lat,
        lng,
        time: new Date().toLocaleTimeString('nl-NL')
    };

    if (onDriverUpdate) onDriverUpdate(driverId, driverInfo[driverId]);
}

export function removeMarker(driverId) {
    if (markers[driverId]) {
        map.removeLayer(markers[driverId]);
        delete markers[driverId];
    }
    delete driverInfo[driverId];
}

export function getDrivers() {
    return { ...driverInfo };
}

export function centerOnDriver(driverId) {
    if (markers[driverId] && map) {
        const pos = markers[driverId].getLatLng();
        map.setView(pos, 14);
    }
}

export function setupRealtimeListeners() {
    const channel = subscribeToLocations(
        (data) => {
            if (data.latitude && data.longitude) {
                updateMarker(
                    data.driver_id,
                    data.latitude,
                    data.longitude,
                    data.driver_name
                );
            }
        },
        (data) => {
            if (data.driver_id) {
                removeMarker(data.driver_id);
            }
        }
    );

    return channel;
}