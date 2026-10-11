/* global RCCore */
// Araç ile önizleme sitesi arasındaki köprü. Araçtan gelen proje dosyalarını
// önizleme sitesinin deposuna yazar ve Service Worker'ı kurar (Teknik Tasarım 3).
(function () {
    const { CACHE_NAME, META_PATH, mimeType } = RCCore;

    // Yalnızca aracın kendi adresinden gelen mesajlar kabul edilir (R-37).
    // Adres, köprü sayfası açılırken ?app= ile verilir ve izin listesiyle sınanır.
    const ALLOWED_APP_ORIGINS = ["http://localhost:5173"];
    const requested = new URLSearchParams(location.search).get("app");
    const appOrigin = ALLOWED_APP_ORIGINS.includes(requested)
        ? requested
        : null;

    async function clearProject() {
        await caches.delete(CACHE_NAME);
    }

    async function ensureServiceWorker() {
        const registration = await navigator.serviceWorker.register(
            "/__rc/sw.js",
            { scope: "/" },
        );
        await navigator.serviceWorker.ready;
        return registration;
    }

    async function loadProject({ files, entry }) {
        await ensureServiceWorker();
        await clearProject();
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(
            files.map(({ path, data }) =>
                cache.put(
                    path,
                    new Response(data, {
                        headers: { "Content-Type": mimeType(path) },
                    }),
                ),
            ),
        );
        await cache.put(
            META_PATH,
            new Response(
                JSON.stringify({ entry, files: files.map((f) => f.path) }),
                { headers: { "Content-Type": "application/json" } },
            ),
        );
    }

    function reply(message) {
        window.parent.postMessage(message, appOrigin);
    }

    window.addEventListener("message", async (event) => {
        if (!appOrigin || event.origin !== appOrigin) return;
        const { type, id } = event.data ?? {};
        try {
            if (type === "rc:load") {
                await loadProject(event.data);
                reply({ type: "rc:done", id });
            } else if (type === "rc:clear") {
                await clearProject();
                reply({ type: "rc:done", id });
            }
        } catch (error) {
            reply({ type: "rc:error", id, message: String(error) });
        }
    });

    // NFR-3.2 / R-20: araç her açıldığında önceki oturumdan kalan proje silinir
    clearProject().finally(() => {
        if (appOrigin) reply({ type: "rc:ready" });
    });
})();
