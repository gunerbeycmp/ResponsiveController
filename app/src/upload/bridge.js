import { PREVIEW_ORIGIN } from "../config.js";

// Önizleme sitesindeki köprü sayfasıyla konuşur: proje dosyalarını gönderir,
// önizleme Service Worker'ı hazır olunca haber verir (Teknik Tasarım 3).
export function createPreviewBridge({
    container = document.body,
    previewOrigin = PREVIEW_ORIGIN,
    appOrigin = window.location.origin,
} = {}) {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.title = "ResponsiveController bridge";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.src = `${previewOrigin}/__rc/bridge.html?app=${encodeURIComponent(appOrigin)}`;

    const pending = new Map();
    let nextId = 1;
    let resolveReady;
    const ready = new Promise((resolve) => {
        resolveReady = resolve;
    });

    window.addEventListener("message", (event) => {
        if (
            event.origin !== previewOrigin ||
            event.source !== frame.contentWindow
        ) {
            return;
        }
        const { type, id, message } = event.data ?? {};
        if (type === "rc:ready") resolveReady();
        if (!pending.has(id)) return;
        const { resolve, reject } = pending.get(id);
        pending.delete(id);
        if (type === "rc:done") resolve();
        if (type === "rc:error") reject(new Error(message));
    });

    container.append(frame);

    async function send(message, transfer = []) {
        await ready;
        const id = nextId++;
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            frame.contentWindow.postMessage(
                { ...message, id },
                previewOrigin,
                transfer,
            );
        });
    }

    return {
        ready,
        // files: [{ path: "/index.html", data: ArrayBuffer }], entry: "/index.html"
        loadProject: (files, entry) =>
            send(
                { type: "rc:load", files, entry },
                files.map((file) => file.data),
            ),
        clearProject: () => send({ type: "rc:clear" }),
        previewUrl: (path = "/") => `${previewOrigin}${path}`,
    };
}
