// Service worker: el menú abre rápido y muestra lo último visto si no hay internet.
const VER = 'menu-v3';
const SHELL = ['./', 'index.html', 'css/styles.css', 'js/menu.js', 'js/data.js', 'js/ui.js', 'js/i18n.js', 'js/config.js', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // La API de Supabase nunca se intercepta (datos siempre frescos; la app guarda su propio respaldo).
  if (url.hostname.endsWith('supabase.co') || url.pathname.startsWith('/api/') || url.pathname.endsWith('admin.html') || url.pathname.endsWith('/js/admin.js')) return;
  const isAsset = /\.(png|jpe?g|webp|avif|svg|woff2?)$/i.test(url.pathname) || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.pathname.includes('/storage/v1/object/public/');
  if (isAsset) {
    // imágenes y fuentes: primero caché
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VER).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit)));
    return;
  }
  if (url.origin !== location.origin) return;
  // páginas y código: primero red, caché si no hay conexión
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VER).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('./') || caches.match('index.html'))));
});
