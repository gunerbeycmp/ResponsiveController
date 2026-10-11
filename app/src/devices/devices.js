import deviceData from "../../../data/devices.json";

export const DEVICES = deviceData;
export const DEFAULT_DEVICE_ID = "iphone-17";

export function findDevice(id, devices = DEVICES) {
    return devices.find((device) => device.id === id) ?? devices[0];
}

export function deviceName(device, t) {
    return device.nameKey ? t(device.nameKey) : device.name;
}

// FR-3.14: görünür alan yalnızca değeri olan (mobil) cihazlarda kullanılabilir
export function deviceSize(device, useVisibleArea) {
    return useVisibleArea && device.visibleArea
        ? device.visibleArea
        : device.screen;
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
