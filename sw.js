// Mi plan · trabajador de fondo: guarda la app en el teléfono para que abra sin internet.
// Al publicar una versión nueva, cambia VERSION: el teléfono baja la nueva y avisa «Actualizar».
const VERSION = '1.0.0'
const CACHE = 'miplan-' + VERSION
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/datos.js', './js/fechas.js', './js/almacen.js',
  './fonts/material-symbols-rounded.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/atajo-peso.png', './icons/atajo-hoy.png', './icons/atajo-super.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('miplan-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('message', (e) => { if (e.data === 'saltar') self.skipWaiting() })

self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== self.location.origin) return
  if (r.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((m) => m || fetch(r)))
    return
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((m) => m || fetch(r)))
})
