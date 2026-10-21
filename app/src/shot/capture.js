import { PREVIEW_ORIGIN } from "../config.js";

const TIMEOUT = 15000;
let nextId = 1;

// FR-4.1: önizlemedeki yardımcı betikten ekran görüntüsü ister (R-40).
// Yanıt yalnızca o iframe'den ve önizleme adresinden kabul edilir.
export function requestCapture(frameWindow, { scale = 1 } = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error("timeout")), TIMEOUT);
        function finish(error, result) {
            clearTimeout(timer);
            window.removeEventListener("message", onMessage);
            if (error) reject(error);
            else resolve(result);
        }
        function onMessage(event) {
            if (event.origin !== PREVIEW_ORIGIN) return;
            if (event.source !== frameWindow) return;
            const data = event.data ?? {};
            if (data.id !== id) return;
            if (data.type === "rc:capture-result")
                finish(null, {
                    blob: data.blob,
                    width: data.width,
                    height: data.height,
                });
            else if (data.type === "rc:capture-error")
                finish(new Error(data.message));
        }
        window.addEventListener("message", onMessage);
        frameWindow.postMessage(
            { type: "rc:capture", id, scale },
            PREVIEW_ORIGIN,
        );
    });
}

const slug = (text) =>
    text
        .toLocaleLowerCase("tr")
        .replace(/ı/g, "i")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const pad = (value) => String(value).padStart(2, "0");

// Dosya adı: cihaz, CSS boyutu, tarih ve saat
// (ör. iphone-17-402x874-2026-10-21-2246.png)
export function shotFileName(name, { width, height }, date = new Date()) {
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
    )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    return `${slug(name)}-${width}x${height}-${stamp}.png`;
}
