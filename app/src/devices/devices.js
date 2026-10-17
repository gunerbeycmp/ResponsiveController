import deviceData from "../../../data/devices.json";

export const DEFAULT_DEVICE_ID = "iphone-17";

const sizeKey = ({ width, height }) => `${width}x${height}`;

// Bilgisayar sekmesinde her çözünürlük bir satırdır (FR-3.1). Bir cihazın
// çözünürlüğü listede yoksa o çözünürlük için seçilebilir bir satır üretilir.
function withResolutionRows(devices) {
    const resolutions = new Set(
        devices
            .filter((d) => d.category === "computer" && d.kind === "resolution")
            .map((d) => sizeKey(d.screen)),
    );
    const generated = [];
    for (const device of devices) {
        if (device.category !== "computer" || device.kind !== "device")
            continue;
        const key = sizeKey(device.screen);
        if (resolutions.has(key)) continue;
        resolutions.add(key);
        generated.push({
            id: `res-${key}`,
            name: `${device.screen.width} × ${device.screen.height}`,
            category: "computer",
            kind: "resolution",
            screen: device.screen,
            dpr: device.dpr,
            popular: false,
            estimated: false,
            source: `${device.source} (cihazın çözünürlüğü)`,
            generated: true,
        });
    }
    return [...devices, ...generated];
}

export const DEVICES = withResolutionRows(deviceData);

export function findDevice(id, devices = DEVICES) {
    return devices.find((device) => device.id === id) ?? devices[0];
}

// Özel isimler çevrilmez; nesil gibi çevrilmesi gereken adlar names alanındadır
export function deviceName(device, language = "tr") {
    return device.names?.[language] ?? device.names?.en ?? device.name;
}

// FR-3.14: görünür alan yalnızca değeri olan (mobil) cihazlarda kullanılabilir
export function deviceSize(device, useVisibleArea) {
    return useVisibleArea && device.visibleArea
        ? device.visibleArea
        : device.screen;
}

// Sayfanın çizildiği boyut. Apple Watch sayfaları 320 px genişlikte çizip
// ekrana küçültür; bu cihazlarda çizim boyutu ekran boyutundan farklıdır.
export function renderSize(device, useVisibleArea) {
    return device.layout ?? deviceSize(device, useVisibleArea);
}

// Önizlemeyi alana sığdıran ölçek; cihaz hiçbir zaman büyütülmez
export function fitScale(size, available) {
    if (available.width <= 0 || available.height <= 0) return 1;
    return Math.min(
        1,
        available.width / size.width,
        available.height / size.height,
    );
}

const swap = ({ width, height }) => ({ width: height, height: width });

// FR-3.6: döndürülmüş cihazda genişlik ile yükseklik yer değiştirir. Yatay
// konum için görünür alan verisi olmadığından tarayıcı çubukları yalnızca
// döndürülmemiş cihazda uygulanır (R-62)
export function viewSize(
    device,
    { rotated = false, browserBars = false } = {},
) {
    const size = deviceSize(device, browserBars && !rotated);
    return rotated ? swap(size) : size;
}

export function viewRenderSize(
    device,
    { rotated = false, browserBars = false } = {},
) {
    const size = renderSize(device, browserBars && !rotated);
    return rotated ? swap(size) : size;
}

export const isLandscape = ({ width, height }) => width > height;

// Cihazın istenen konuma geçmesi için döndürülmüş olması gerekip gerekmediği
export const rotatedFor = (device, landscape) =>
    isLandscape(device.screen) !== landscape &&
    device.screen.width !== device.screen.height;
