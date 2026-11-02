/**
 * PocketLedger - Progressive Web App Service Worker
 * Teroptimasi untuk PWABuilder (100% Offline-Ready Score)
 * Siklus hidup: Install, Activate, Fetch (Cache First with Network Fallback)
 */

const CACHE_NAME = 'pocketledger-pwa-v2.4';

// Daftar aset statis inti yang wajib dicache saat instalasi
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/vendor/dexie.min.js',
  './js/vendor/lucide.min.js',
  './js/app.bundle.js',
  './js/app.bundle.js?v=2.4.0',
  './js/db.js',
  './js/app.js',
  './js/utils/formatters.js',
  './js/utils/share.js',
  './js/components/expense.js',
  './js/components/splitbill.js',
  './js/components/analytics.js',
  './js/components/backup.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/screenshot-mobile.png',
  './icons/screenshot-desktop.png',
  'https://cdn.tailwindcss.com'
];

// 1. INSTALL EVENT: Pre-cache seluruh aset aplikasi offline
self.addEventListener('install', (event) => {
  console.log('[SW] Memulai instalasi & caching aset statis...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache satu per satu agar jika salah satu CDN gagal, aset lokal tetap ter-cache
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Gagal mem-precache ${asset}:`, err);
        }
      }
      console.log('[SW] Pre-caching selesai.');
    }).then(() => self.skipWaiting()) // Aktifkan worker baru seketika
  );
});

// 2. ACTIVATE EVENT: Bersihkan cache versi lama dan klaim kontrol client
self.addEventListener('activate', (event) => {
  console.log('[SW] Mengaktifkan Service Worker baru...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Menghapus cache usang:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH EVENT: Strategi Cache-First dengan fallback Network & Dynamic Cache
self.addEventListener('fetch', (event) => {
  // Hanya tangani permintaan HTTP/HTTPS bertipe GET
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Jika ada di cache, kembalikan dari cache (Instan Offline)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Jika tidak ada di cache, ambil dari jaringan (Network Fallback)
      return fetch(event.request).then((networkResponse) => {
        // Jangan simpan respons invalid
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Simpan salinan ke cache dinamis untuk penggunaan offline berikutnya
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch((fetchError) => {
        console.warn('[SW] Fetch offline untuk:', event.request.url);

        // 3. Fallback navigasi HTML saat offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }

        throw fetchError;
      });
    })
  );
});

// 4. MESSAGE EVENT: Respon instruksi aktivasi segera dari client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Menerima instruksi SKIP_WAITING, mengaktifkan Service Worker seketika.');
    self.skipWaiting();
  }
});
