// Service Worker do Tribuss PWA — escrito à mão (sem next-pwa/Serwist) porque
// o projeto roda em Turbopack (next dev/build --turbopack), e os plugins
// webpack do Workbox usados por essas libs não são compatíveis com o
// pipeline do Turbopack. Estratégia deliberadamente simples e auditável:
//   - App shell (offline, manifest, ícones): pré-cache no install.
//   - Navegações (documentos HTML): network-first, cai para o cache e depois
//     para /offline se a rede falhar.
//   - Estáticos do Next (/_next/static/...) e outros assets same-origin:
//     stale-while-revalidate (serve rápido do cache, atualiza em segundo plano).
// Bump CACHE_VERSION a cada mudança relevante para invalidar caches antigos.
const CACHE_VERSION = "v1"
const APP_SHELL_CACHE = `tribuss-shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `tribuss-runtime-${CACHE_VERSION}`

const APP_SHELL_URLS = ["/offline", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  )
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, response.clone())
    return response
  } catch {
    const cache = await caches.open(RUNTIME_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
    const shellCache = await caches.open(APP_SHELL_CACHE)
    return (await shellCache.match("/offline")) || Response.error()
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  return cached || (await networkPromise) || Response.error()
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return // nunca cachear chamadas de API (dados sempre precisam ser frescos)

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
