// Service Worker ve köprünün ortak, saf fonksiyonları (Teknik Tasarım 3, 7.3).
// Hem importScripts ile (Service Worker) hem import ile (testler) yüklenebilmesi
// için dışa aktarma yerine globalThis.RCCore kullanılır.
(function (root) {
    const RESERVED_PREFIX = "/__rc/";
    const META_PATH = "/__rc/meta.json";
    const CACHE_NAME = "rc-project-v1";

    const MIME_TYPES = {
        html: "text/html; charset=utf-8",
        htm: "text/html; charset=utf-8",
        css: "text/css; charset=utf-8",
        js: "text/javascript; charset=utf-8",
        mjs: "text/javascript; charset=utf-8",
        json: "application/json; charset=utf-8",
        map: "application/json; charset=utf-8",
        txt: "text/plain; charset=utf-8",
        xml: "application/xml; charset=utf-8",
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        avif: "image/avif",
        ico: "image/x-icon",
        bmp: "image/bmp",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        otf: "font/otf",
        mp4: "video/mp4",
        webm: "video/webm",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        pdf: "application/pdf",
        wasm: "application/wasm",
        webmanifest: "application/manifest+json",
    };

    function mimeType(path) {
        const extension = path.split(".").pop().toLowerCase();
        return MIME_TYPES[extension] ?? "application/octet-stream";
    }

    // "/klasor/" → "/klasor/index.html", yüzde kodlamaları çözülür
    function normalizePath(pathname) {
        let path;
        try {
            path = decodeURIComponent(pathname);
        } catch {
            path = pathname;
        }
        if (!path.startsWith("/")) path = `/${path}`;
        if (path.endsWith("/")) path += "index.html";
        return path;
    }

    // Bir isteğin nasıl yanıtlanacağına karar verir (Teknik Tasarım 7.3):
    // - /__rc/ altındaki istekler önizlemenin kendi dosyalarıdır, ağa gider
    // - projede olan dosya doğrudan verilir
    // - uzantısız klasör adresi (/hakkinda) için /hakkinda/index.html denenir
    // - bulunamayan sayfa adresleri başlangıç sayfasına yönlendirilir
    // - bulunamayan dosyalar (CSS, JS, görsel) 404 döner, hatalar gizlenmez
    function resolveRequest({ pathname, isNavigation, hasFile, entry }) {
        if (pathname.startsWith(RESERVED_PREFIX)) return { type: "network" };

        const path = normalizePath(pathname);
        if (hasFile(path)) return { type: "file", path };

        const lastSegment = path.split("/").pop();
        if (!lastSegment.includes(".") && hasFile(`${path}/index.html`)) {
            return { type: "file", path: `${path}/index.html` };
        }
        if (isNavigation && entry) return { type: "file", path: entry };
        return { type: "notFound" };
    }

    const HELPER_TAG = '<script src="/__rc/helper.js"></script>';

    // Yardımcı betiği HTML sayfalarına ekler (R-40, R-44). Betik sayfaya görsel
    // hiçbir şey eklemez; <head> varsa onun başına, yoksa en başa konur.
    function injectHelper(html) {
        const head = /<head(\s[^>]*)?>/i.exec(html);
        if (head) {
            const at = head.index + head[0].length;
            return html.slice(0, at) + HELPER_TAG + html.slice(at);
        }
        const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
        const at = doctype ? doctype[0].length : 0;
        return html.slice(0, at) + HELPER_TAG + html.slice(at);
    }

    root.RCCore = {
        injectHelper,
        CACHE_NAME,
        META_PATH,
        RESERVED_PREFIX,
        mimeType,
        normalizePath,
        resolveRequest,
    };
})(globalThis);
