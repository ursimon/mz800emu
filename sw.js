/**
 * sw.js — Sharp MZ-800 Emulator Service Worker
 *
 * Implements an Anti-Stale offline-first caching architecture:
 * 1. Network-First with Cache Fallback for Navigation (index.html) so updates
 *    are never missed when online.
 * 2. Stale-While-Revalidate / Cache-First for static assets (.wasm, .js, .css, icons)
 *    so startup is instantaneous and works 100% offline.
 * 3. Proactive Cache Purge during activation: all obsolete cache buckets are wiped.
 * 4. Controlled Skip-Waiting: listens for UI 'SKIP_WAITING' messages to reload cleanly.
 */

const CACHE_VERSION = 'mz800-pwa-v1.0.2';
const CACHE_NAME = CACHE_VERSION;

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './mz800.js',
    './mz800.wasm',
    './emulator.js',
    './controls.js',
    './controls.css',
    './favicon.svg',
    './favicon.png',
    './apple-touch-icon.png',
    './apple-touch-icon.svg',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-192.png',
    './icon-maskable-512.png',
    './manifest.webmanifest',
    './games/mz_runner.mzf',
    './games/unicard_mgr.mzf'
];

// 1. Install: Pre-cache core runtime assets and immediately skip waiting to prevent limbo
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Installing version:', CACHE_NAME);
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Pre-caching core offline assets...');
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
});


// 2. Activate: Purge any older cache versions and claim clients
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activating version:', CACHE_NAME);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[ServiceWorker] Deleting obsolete cache bucket:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => {
            console.log('[ServiceWorker] Claiming clients for:', CACHE_NAME);
            return self.clients.claim();
        })
    );
});

// 3. Message handler: listen for SKIP_WAITING from UI update prompt
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[ServiceWorker] Received SKIP_WAITING signal, skipping waiting...');
        self.skipWaiting();
    }
});

// 4. Fetch Strategy
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // Cross-origin requests (e.g. remote ROM downloads / CORS proxies): pass through
    if (url.origin !== self.location.origin) {
        return;
    }

    // A. Navigation requests (HTML document): Network-First with Cache Fallback
    // This strictly prevents the app from being stuck on an old index.html when online!
    const isNavigation = request.mode === 'navigate' ||
                         request.destination === 'document' ||
                         url.pathname.endsWith('/') ||
                         url.pathname.endsWith('/index.html');

    if (isNavigation) {
        event.respondWith(
            networkFirstWithTimeout(request, 2500)
        );
        return;
    }

    // B. Static Assets (.wasm, .js, .css, images, fonts): Cache-First with Stale-While-Revalidate
    event.respondWith(
        cacheFirstWithRevalidate(request)
    );
});

/**
 * Network-First with a short timeout.
 * If online and server responds, caches and returns the fresh HTML.
 * If network takes longer than timeoutMs or fails (offline), falls back to Cache.
 */
async function networkFirstWithTimeout(request, timeoutMs) {
    const cache = await caches.open(CACHE_NAME);

    // Create a network fetch promise with background cache update
    const networkPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    });

    // Create timeout promise
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
    });

    try {
        const response = await Promise.race([networkPromise, timeoutPromise]);
        if (response) {
            return response;
        }
        // Timed out: try cache
        console.warn('[ServiceWorker] Navigation network fetch timed out, falling back to cache');
        const cached = await cache.match(request) || await cache.match('./index.html') || await cache.match('./');
        if (cached) return cached;
        // If cache empty, await network
        return await networkPromise;
    } catch (err) {
        console.log('[ServiceWorker] Navigation fetch failed (offline), falling back to cache:', err);
        const cached = await cache.match(request) || await cache.match('./index.html') || await cache.match('./');
        if (cached) return cached;
        throw err;
    }
}

/**
 * Cache-First with background revalidation for static assets.
 */
async function cacheFirstWithRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Fetch in background to update cache for next time if online
        fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse);
            }
        }).catch(() => {
            // Offline or network error: silent catch
        });
        return cachedResponse;
    }

    // Not in cache: fetch from network, cache, and return
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (err) {
        console.warn('[ServiceWorker] Asset fetch failed and not in cache:', request.url);
        throw err;
    }
}
