// geolocation-tracker.js
// Dit bestand bevat de GPS-logica

import { sendLocation } from './supabase-client.js';

let watchId = null;
let updateCount = 0;
let isTracking = false;
let onStatusUpdate = null;

export function startTracking(driverId, options = {}) {
    const {
        onLocation = null,      // Callback bij elke locatie
        onStatus = null,        // Callback voor status updates
        onError = null,         // Callback voor fouten
        driverName = null,
        highAccuracy = true,
        timeout = 10000
    } = options;

    onStatusUpdate = onStatus;

    if (!navigator.geolocation) {
        if (onError) onError('Geolocatie wordt niet ondersteund');
        return false;
    }

    isTracking = true;
    updateCount = 0;
    
    if (onStatus) onStatus('started', 'Locatie wordt opgehaald...');

    watchId = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            updateCount++;
            
            if (onStatus) {
                onStatus('update', {
                    count: updateCount,
                    latitude,
                    longitude,
                    accuracy: position.coords.accuracy
                });
            }

            // Stuur naar Supabase
            try {
                await sendLocation(driverId, latitude, longitude, driverName);
                if (onLocation) onLocation(latitude, longitude, position.coords);
            } catch (error) {
                if (onError) onError(error.message);
            }
        },
        (error) => {
            if (onError) onError(error.message);
        },
        {
            enableHighAccuracy: highAccuracy,
            timeout: timeout,
            maximumAge: 0
        }
    );

    return true;
}

export function stopTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    isTracking = false;
    if (onStatusUpdate) onStatusUpdate('stopped', 'Tracking gestopt');
}

export function getTrackingStatus() {
    return {
        isTracking,
        updateCount
    };
}