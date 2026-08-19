// ============================================================
// SERVICE WORKER - Houdt de tracker actief (Verbeterd)
// ============================================================

const CACHE_NAME = 'tracker-v2';
const FILES_TO_CACHE = [
    '/Project/tracker.html',
    '/Project/js/config.js',
    '/Project/js/core/supabase.js'
];

// ============================================================
// INSTALLATIE
// ============================================================
self.addEventListener('install', (event) => {
    console.log('📦 Service Worker: Installeren...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Bestanden cachen...');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => {
                console.log('✅ Service Worker: Installatie voltooid');
                return self.skipWaiting();
            })
    );
});

// ============================================================
// ACTIVATIE
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activeren...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('🗑️ Service Worker: Oude cache verwijderd:', key);
                    return caches.delete(key);
                }
            }));
        })
        .then(() => {
            console.log('✅ Service Worker: Geactiveerd');
            return self.clients.claim();
        })
    );
});

// ============================================================
// FETCH - Offline ondersteuning
// ============================================================
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request)
                    .catch(() => {
                        return new Response('Offline - tracker werkt niet', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// ============================================================
// BERICHTEN VAN CLIENT
// ============================================================
self.addEventListener('message', (event) => {
    console.log('📩 Service Worker: Bericht ontvangen:', event.data);
    
    if (event.data && event.data.type === 'ping') {
        // Stuur een pong terug
        event.source.postMessage({
            type: 'pong',
            timestamp: Date.now(),
            clientId: event.source.id
        });
        console.log('💓 Service Worker: Pong verzonden');
    }
    
    if (event.data && event.data.type === 'get-clients') {
        // Stuur een lijst van clients terug
        self.clients.matchAll().then(clients => {
            event.source.postMessage({
                type: 'clients-list',
                clients: clients.map(c => ({
                    id: c.id,
                    url: c.url,
                    type: c.type
                }))
            });
        });
    }
});

// ============================================================
// BACKGROUND SYNC
// ============================================================
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Sync event:', event.tag);
    
    if (event.tag === 'tracker-sync') {
        event.waitUntil(syncTracker());
    }
});

async function syncTracker() {
    console.log('🔄 Service Worker: Background sync gestart');
    
    try {
        // Stuur een bericht naar alle clients om de tracker te herstarten
        const clients = await self.clients.matchAll({
            includeUncontrolled: true,
            type: 'window'
        });
        
        console.log(`📨 Service Worker: ${clients.length} clients gevonden`);
        
        if (clients.length === 0) {
            console.warn('⚠️ Service Worker: Geen clients gevonden');
            return;
        }
        
        clients.forEach(client => {
            client.postMessage({
                type: 'sync',
                message: 'Herstart tracker',
                timestamp: Date.now()
            });
            console.log('📨 Service Worker: Bericht gestuurd naar client');
        });
    } catch (err) {
        console.error('❌ Service Worker: Sync fout:', err);
    }
}

// ============================================================
// PERIODIC SYNC (experimenteel - alleen Chrome)
// ============================================================
self.addEventListener('periodicsync', (event) => {
    console.log('🔄 Service Worker: Periodic sync:', event.tag);
    
    if (event.tag === 'tracker-periodic-sync') {
        event.waitUntil(syncTracker());
    }
});

// ============================================================
// PUSH NOTIFICATIES (optioneel)
// ============================================================
self.addEventListener('push', (event) => {
    console.log('📨 Service Worker: Push ontvangen:', event.data?.text());
    
    const data = event.data?.json() || {};
    const title = data.title || 'Tracker Update';
    const options = {
        body: data.body || 'De tracker is nog steeds actief',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ============================================================
// NOTIFICATIE KLIK
// ============================================================
self.addEventListener('notificationclick', (event) => {
    console.log('📨 Service Worker: Notification click:', event.notification.data);
    
    event.notification.close();
    
    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            if (clientList.length > 0) {
                // Focus op de eerste client
                return clientList[0].focus();
            }
            // Open een nieuwe client
            return self.clients.openWindow('/Project/tracker.html');
        })
    );
});

console.log('✅ Service Worker: Geladen en klaar');