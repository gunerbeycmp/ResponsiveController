// Sol menünün içeriğini cihaz verisinden oluşturan saf fonksiyonlar
// (FR-3.1, FR-3.3, FR-3.4, Aşama 3 Tasarım Kararları).

export const TABS = ["phone", "tablet", "watch", "tv", "computer"];
const BRAND_ORDER = [
    "Apple",
    "Samsung",
    "Google",
    "OnePlus",
    "Huawei",
    "Microsoft",
];

const sizeKey = ({ width, height }) => `${width}x${height}`;

function byBrand(devices) {
    const groups = new Map();
    for (const device of devices) {
        const brand = device.brand ?? "";
        if (!groups.has(brand)) groups.set(brand, []);
        groups.get(brand).push(device);
    }
    return [...groups.entries()]
        .sort(
            ([a], [b]) =>
                (BRAND_ORDER.indexOf(a) + 1 || 99) -
                (BRAND_ORDER.indexOf(b) + 1 || 99),
        )
        .map(([brand, items]) => ({ type: "brand", brand, items }));
}

// Bilgisayar sekmesi: her çözünürlük bir satır, o çözünürlüğü kullanan
// cihazlar satırın altında açılır (FR-3.1)
function resolutionRows(devices) {
    const resolutions = devices
        .filter((d) => d.kind === "resolution")
        .sort(
            (a, b) =>
                a.screen.width - b.screen.width ||
                a.screen.height - b.screen.height,
        );
    return resolutions.map((resolution) => ({
        resolution,
        devices: devices.filter(
            (d) =>
                d.kind === "device" &&
                sizeKey(d.screen) === sizeKey(resolution.screen),
        ),
    }));
}

export function buildTab(devices, tab) {
    const inTab = devices.filter((d) => d.category === tab);
    const groups = [];
    const popular = inTab.filter((d) => d.popular);
    if (popular.length > 0) groups.push({ type: "popular", items: popular });

    if (tab === "computer") {
        groups.push({ type: "resolutions", rows: resolutionRows(inTab) });
    } else {
        groups.push(...byBrand(inTab));
    }

    const generic = devices.filter((d) => d.category === "generic");
    if (generic.length > 0) groups.push({ type: "generic", items: generic });
    return groups;
}

// Favoriler sekmesi: önce "Sık kullanılan favoriler" (elle sıralı), sonra
// kalan favoriler kategorilere göre, ekleme sırasıyla (FR-3.2)
export function buildFavorites(devices, ids, frequent = []) {
    const byId = new Map(devices.map((d) => [d.id, d]));
    const pick = (list) => list.map((id) => byId.get(id)).filter(Boolean);
    const groups = [];
    const top = pick(frequent);
    if (top.length > 0) groups.push({ type: "frequent", items: top });
    const rest = pick(ids.filter((id) => !frequent.includes(id)));
    for (const category of [...TABS, "generic"]) {
        const items = rest.filter((d) => d.category === category);
        if (items.length > 0)
            groups.push({ type: "category", category, items });
    }
    return groups;
}

const normalize = (text) =>
    text
        .toLocaleLowerCase("tr")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ı/g, "i")
        .replace(/\s*[×x]\s*/g, "x");

// Arama ad (iki dilde), marka ve boyutta yapılır; sonuçlar sekmelere göre gruplanır
export function searchDevices(devices, query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const matches = devices.filter((device) => {
        const haystack = normalize(
            [
                device.name,
                device.names?.tr,
                device.names?.en,
                device.brand,
                `${device.screen.width}x${device.screen.height}`,
            ]
                .filter(Boolean)
                .join(" "),
        );
        return terms.every((term) => haystack.includes(term));
    });
    return [...TABS, "generic", "custom"]
        .map((category) => ({
            type: "category",
            category,
            items: matches.filter((d) => d.category === category),
        }))
        .filter((group) => group.items.length > 0);
}

export const tabOf = (device) => {
    if (device.category === "custom") return "custom";
    return TABS.includes(device.category) ? device.category : "phone";
};
