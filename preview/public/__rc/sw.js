/* global RCCore */
// Yüklenen projeyi önizleme sitesinin kökünden sunan Service Worker
// (Teknik Tasarım 3). Proje dosyaları köprü tarafından Cache Storage'a yazılır.
importScripts("/__rc/core.js");

const { CACHE_NAME, META_PATH, resolveRequest } = RCCore;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

async function readMeta(cache) {
    const response = await cache.match(META_PATH);
    return response ? response.json() : null;
}

async function respond(request) {
    const cache = await caches.open(CACHE_NAME);
    const meta = await readMeta(cache);
    const url = new URL(request.url);

    // Yüklü proje yoksa önizleme sitesinin kendi sayfaları gösterilir
    if (!meta) return fetch(request);

    const files = new Set(meta.files);
    const decision = resolveRequest({
        pathname: url.pathname,
        isNavigation: request.mode === "navigate",
        hasFile: (path) => files.has(path),
        entry: meta.entry,
    });

    if (decision.type === "network") return fetch(request);
    if (decision.type === "file") {
        const cached = await cache.match(decision.path);
        if (cached) return cached;
    }
    return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    // Yalnızca önizleme sitesinin kendi adresleri; harici istekler dokunulmadan geçer
    if (url.origin !== self.location.origin) return;
    if (event.request.method !== "GET") return;
    event.respondWith(respond(event.request));
});
