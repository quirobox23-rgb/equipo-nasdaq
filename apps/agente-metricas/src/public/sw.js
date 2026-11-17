// ─────────────────────────────────────────────
//  NOVA METRICS — Service Worker (fase 1: cache estático básico)
//
//  Deliberadamente simple, sin Workbox: solo cachea assets estáticos
//  del propio origen (js/css/imágenes/fuentes) con estrategia
//  cache-first + actualización en segundo plano. NUNCA cachea HTML
//  ni llamadas dinámicas — no hay soporte offline completo, tal
//  como pide el Sprint ("solo cache estático").
// ─────────────────────────────────────────────

const CACHE_NAME = 'nova-metrics-v1'
const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|svg|woff2?|ico)$/

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!STATIC_EXTENSIONS.test(url.pathname)) return // nunca HTML ni rutas dinámicas

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
