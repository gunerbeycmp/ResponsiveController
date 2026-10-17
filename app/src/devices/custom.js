import en from "../i18n/en.json";
import tr from "../i18n/tr.json";
import { DEVICES, deviceName } from "./devices.js";

// FR-3.11, D-10: özel boyutun sınırları
export const MIN_SIZE = 100;
export const MAX_SIZE = 3840;

const TEXTS = { tr, en };
const format = (template, params) =>
    template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");

export function isValidSize({ width, height }) {
    return [width, height].every(
        (value) =>
            Number.isInteger(value) && value >= MIN_SIZE && value <= MAX_SIZE,
    );
}

// Sürüklerken sınırların dışına çıkılmaz
export function clampSize({ width, height }) {
    const clamp = (value) =>
        Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
    return { width: clamp(width), height: clamp(height) };
}

// Ad iki dilde de üretilir; böylece dil değişince ad da çevrilir.
// Kullanıcı adı değiştirirse iki dilde de aynı ad kullanılır.
function namesFor(source, number) {
    const names = {};
    for (const language of Object.keys(TEXTS)) {
        const t = TEXTS[language];
        names[language] = source
            ? format(
                  number === 1
                      ? t["custom.derivedName"]
                      : t["custom.derivedNameN"],
                  { device: deviceName(source, language), number },
              )
            : format(t["custom.defaultName"], { number });
    }
    return names;
}

// Özel boyutlar yalnızca bu oturumda tutulur, kaydedilmez (FR-3.11, R-19).
// Oluşturulan boyutlar cihaz listesine eklenir; böylece seçme, ızgara ve
// döndürme diğer cihazlar gibi çalışır.
export function createCustomSizes({ devices = DEVICES } = {}) {
    let counter = 0;
    let plainCount = 0;
    const derivedCount = new Map();

    const list = () => devices.filter((device) => device.custom);
    const find = (id) => list().find((device) => device.id === id);

    return {
        list,
        find,
        // source: türetildiği hazır cihaz (yoksa Özel sekmesinden oluşturulur)
        create(size, source = null) {
            let number;
            if (source) {
                number = (derivedCount.get(source.id) ?? 0) + 1;
                derivedCount.set(source.id, number);
            } else {
                plainCount += 1;
                number = plainCount;
            }
            counter += 1;
            const device = {
                id: `custom-${counter}`,
                custom: true,
                category: "custom",
                names: namesFor(source, number),
                screen: { width: size.width, height: size.height },
                dpr: 1,
                popular: false,
                estimated: false,
                sourceId: source?.id ?? null,
            };
            devices.push(device);
            return device;
        },
        resize(id, size) {
            const device = find(id);
            if (device) device.screen = { ...size };
            return device;
        },
        rename(id, name) {
            const device = find(id);
            const trimmed = name.trim();
            if (!device || !trimmed) return device;
            device.names = Object.fromEntries(
                Object.keys(TEXTS).map((language) => [language, trimmed]),
            );
            return device;
        },
        remove(id) {
            const index = devices.findIndex(
                (device) => device.custom && device.id === id,
            );
            if (index === -1) return null;
            return devices.splice(index, 1)[0];
        },
    };
}
