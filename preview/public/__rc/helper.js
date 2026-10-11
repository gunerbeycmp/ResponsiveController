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
})();
