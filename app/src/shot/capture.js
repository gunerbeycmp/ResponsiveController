import { PREVIEW_ORIGIN } from "../config.js";

const TIMEOUT = 15000;
let nextId = 1;

// FR-4.1: önizlemedeki yardımcı betikten ekran görüntüsü ister (R-40).
// Yanıt yalnızca o iframe'den ve önizleme adresinden kabul edilir.
export function requestCapture(
    frameWindow,
    { scale = 1, mode = "visible" } = {},
) {
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
                    blobs: data.blobs,
                    width: data.width,
                    height: data.height,
                    scale: data.scale,
                    reduced: data.reduced,
                });
            else if (data.type === "rc:capture-error")
                finish(new Error(data.message));
        }
        window.addEventListener("message", onMessage);
        frameWindow.postMessage(
            { type: "rc:capture", id, scale, mode },
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

// Dosya adı: cihaz, CSS boyutu, (tam sayfa eki), tarih ve saat
// (ör. iphone-17-402x874-tam-sayfa-2026-10-21-2246.png)
export function shotFileName(
    name,
    { width, height },
    { date = new Date(), suffix = "", extension = "png" } = {},
) {
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
    )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    const parts = [slug(name), `${width}x${height}`, suffix, stamp];
    return `${parts.filter(Boolean).join("-")}.${extension}`;
}

// Toplu dosya adı: önek, (tam sayfa eki), tarih ve saat
// (ör. izgara-2026-10-21-2330.zip, izgara-tam-sayfa-2026-10-21-2330.zip)
export function batchFileName(
    prefix,
    { date = new Date(), suffix = "", extension = "zip" } = {},
) {
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
    )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    return `${[slug(prefix), suffix, stamp].filter(Boolean).join("-")}.${extension}`;
}

// Toplu ZIP içindeki cihaz dosyası (ör. iphone-17-402x874.png); aynı ad
// tekrar ederse sonuna sayı eklenir
export function entryFileName(name, { width, height }, extension, taken = {}) {
    const base = `${slug(name)}-${width}x${height}`;
    let candidate = `${base}.${extension}`;
    for (let number = 2; Object.hasOwn(taken, candidate); number += 1)
        candidate = `${base}-${number}.${extension}`;
    return candidate;
}

// ZIP içindeki parça adı (ör. parca-01.png, parca-01.jpg)
export const partFileName = (prefix, index, extension = "png") =>
    `${prefix}-${String(index + 1).padStart(2, "0")}.${extension}`;
