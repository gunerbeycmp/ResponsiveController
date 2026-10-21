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
    async function capture({ mode, scale }) {
        const [{ domToBlob }, plan] = await Promise.all([
            import("/__rc/vendor/modern-screenshot.js"),
            import("/__rc/shot-plan.js"),
        ]);
        const width = window.innerWidth;
        const shoot = (top, height, at) =>
            domToBlob(document.documentElement, {
                width,
                height,
                scale: at,
                type: "image/png",
                style: {
                    transform: `translate(${-window.scrollX}px, ${-top}px)`,
                },
            });

        // Görünen alan: sayfa kaydırılmışsa kopya o kadar kaydırılır
        if (mode === "visible") {
            const height = window.innerHeight;
            const blob = await shoot(window.scrollY, height, scale);
            return { blobs: [blob], width, height, scale, reduced: false };
        }

        // Tam sayfa ve parçalar (FR-4.1, R-64)
        const height = Math.max(
            document.documentElement.scrollHeight,
            document.body?.scrollHeight ?? 0,
        );
        const limits = plan.canvasLimits(navigator.userAgent);
        if (mode === "parts") {
            const blobs = [];
            for (const part of plan.partPlan({ width, height, scale, limits }))
                blobs.push(await shoot(part.top, part.height, scale));
            return { blobs, width, height, scale, reduced: false };
        }
        const fit = plan.fitScale({ width, height, scale, limits });
        const blob = await shoot(0, height, fit.scale);
        return { blobs: [blob], width, height, ...fit };
    }

    window.addEventListener("message", async (event) => {
        if (!APP_ORIGINS.includes(event.origin)) return;
        if (event.source !== window.parent) return;
        const { type, id, scale, mode } = event.data ?? {};
        if (type !== "rc:capture") return;
        try {
            const result = await capture({
                mode: ["visible", "full", "parts"].includes(mode)
                    ? mode
                    : "visible",
                scale: Number(scale) || 1,
            });
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
