// ============================================================
// SERVICE WORKER - Houdt de tracker actief
// ============================================================

const CACHE_NAME = 'tracker-v1';
const FILES_TO_CACHE = [
    '/Project/tracker.html',
    '/Project/js/config.js',
    '/Project/js/core/supabase.js'
];

// Installeren van de service worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Bestanden cachen...');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activeren van de service worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('🗑️ Service Worker: Oude cache verwijderd');
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Offline fallback
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
            .catch(() => {
                // Offline: toon een eenvoudige melding
                return new Response('Offline - tracker werkt niet');
            })
    );
});

// Background sync (als de browser dit ondersteunt)
self.addEventListener('sync', (event) => {
    if (event.tag === 'tracker-sync') {
        event.waitUntil(syncTracker());
    }
});

async function syncTracker() {
    console.log('🔄 Background sync gestart');
    // Stuur een ping naar de server om de verbinding te herstellen
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'sync', message: 'Herstart tracker' });
    });
}

console.log('✅ Service Worker geladen');