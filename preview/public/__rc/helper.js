// Önizlenen projenin sayfalarına eklenen yardımcı betik (R-40, R-44).
// Sayfaya görsel hiçbir şey eklemez; yalnızca açık sayfanın yolunu araca bildirir.
(function () {
    if (window.parent === window) return;

    // Yalnızca izinli araç adreslerine mesaj gönderilir (bridge.js ile aynı liste)
    const APP_ORIGINS = ["http://localhost:5173"];

    function report() {
        const path = location.pathname + location.search + location.hash;
        for (const origin of APP_ORIGINS) {
            window.parent.postMessage({ type: "rc:navigate", path }, origin);
        }
    }

    // Tek sayfalık uygulamalar adresi history API ile değiştirir
    for (const method of ["pushState", "replaceState"]) {
        const original = history[method];
        history[method] = function (...args) {
            const result = original.apply(this, args);
            report();
            return result;
        };
    }
    window.addEventListener("popstate", report);
    window.addEventListener("hashchange", report);
    report();

    // FR-4.1: ekran görüntüsü önizlemenin içinde alınır; araç önizlemenin
    // içeriğine erişemediği için görüntü araca mesajla gönderilir (R-40).
    // Kütüphane yalnızca istenince yüklenir, sayfaya görsel bir şey eklemez.
    async function capture({ scale }) {
        const { domToBlob } = await import("/__rc/vendor/modern-screenshot.js");
        const width = window.innerWidth;
        const height = window.innerHeight;
        // Görünen alan: sayfa kaydırılmışsa kopya o kadar kaydırılır
        const blob = await domToBlob(document.documentElement, {
            width,
            height,
            scale,
            type: "image/png",
            style: {
                transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
            },
        });
        return { blob, width, height };
    }

    window.addEventListener("message", async (event) => {
        if (!APP_ORIGINS.includes(event.origin)) return;
        if (event.source !== window.parent) return;
        const { type, id, scale } = event.data ?? {};
        if (type !== "rc:capture") return;
        try {
            const result = await capture({ scale: Number(scale) || 1 });
            window.parent.postMessage(
                { type: "rc:capture-result", id, ...result },
                event.origin,
            );
        } catch (error) {
            window.parent.postMessage(
                { type: "rc:capture-error", id, message: String(error) },
                event.origin,
            );
        }
    });
})();
