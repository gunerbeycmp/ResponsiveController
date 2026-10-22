// Aşama 6 revizyonu: önizleme yüklenirken ekran alanının ortasında
// "Yükleniyor…". Araç adres verdiğinde başlar, sayfa yüklenince ya da en geç
// 20 saniye sonra kalkar. Sitenin kendi içindeki gezinmeler gösterge çıkarmaz.
// Sesli duyuru yapılmaz; önizleme alanı yüklenirken aria-busy olur.
export const LOADING_TIMEOUT = 20000;

// Göstergenin öğeleri (ızgara kutuları için); tek cihazda index.html'de
export function buildLoading() {
    const overlay = document.createElement("div");
    overlay.className = "preview-loading";
    overlay.hidden = true;
    const spinner = document.createElement("span");
    spinner.className = "preview-spinner";
    spinner.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    overlay.append(spinner, text);
    return { overlay, text };
}

export function trackLoading({ iframe, overlay, region }) {
    let waiting = false;
    let timer = 0;

    function stop() {
        waiting = false;
        clearTimeout(timer);
        overlay.hidden = true;
        region?.removeAttribute("aria-busy");
    }

    iframe.addEventListener("load", () => {
        if (!waiting) return;
        // Yeni adresten önce boş sayfa yüklenirse beklemeye devam edilir;
        // önizlenen site ayrı bir siteden geldiği için adresi okunamaz
        try {
            if (iframe.contentWindow?.location.href === "about:blank") return;
        } catch {
            // Ayrı siteden gelen sayfa yüklendi
        }
        stop();
    });

    return {
        // Araç iframe'e adres verdikten hemen sonra çağrılır
        start() {
            waiting = true;
            overlay.hidden = false;
            region?.setAttribute("aria-busy", "true");
            clearTimeout(timer);
            timer = setTimeout(stop, LOADING_TIMEOUT);
        },
        stop,
        isLoading: () => waiting,
    };
}
