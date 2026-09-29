// UsForge's service worker. It deliberately does nothing to requests (no caching, so updates always show):
// it exists only because some browsers only offer "Install app" when a site has one.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
