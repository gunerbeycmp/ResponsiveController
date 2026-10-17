import { describe, expect, it } from "vitest";
import {
    MAX_SIZE,
    MIN_SIZE,
    clampSize,
    createCustomSizes,
    isValidSize,
} from "../../app/src/devices/custom.js";
import { findDevice } from "../../app/src/devices/devices.js";
import { searchDevices, tabOf } from "../../app/src/devices/menu.js";

describe("özel boyut sınırları (FR-3.11, D-10)", () => {
    it("100 - 3840 arası tam sayıları kabul eder", () => {
        expect(MIN_SIZE).toBe(100);
        expect(MAX_SIZE).toBe(3840);
        expect(isValidSize({ width: 100, height: 3840 })).toBe(true);
        expect(isValidSize({ width: 99, height: 500 })).toBe(false);
        expect(isValidSize({ width: 500, height: 3841 })).toBe(false);
        expect(isValidSize({ width: 500.5, height: 500 })).toBe(false);
        expect(isValidSize({ width: Number(""), height: 500 })).toBe(false);
    });

    it("sürüklerken sınırlara çeker ve yuvarlar", () => {
        expect(clampSize({ width: 20, height: 9000 })).toEqual({
            width: 100,
            height: 3840,
        });
        expect(clampSize({ width: 450.6, height: 700.2 })).toEqual({
            width: 451,
            height: 700,
        });
    });
});

describe("özel boyutlar (FR-3.10, FR-3.11)", () => {
    const setup = () => {
        const devices = [findDevice("iphone-17")];
        return { devices, custom: createCustomSizes({ devices }) };
    };

    it("Özel sekmesinden oluşturulanlar sırayla numaralanır, iki dilde ad alır", () => {
        const { custom } = setup();
        const first = custom.create({ width: 500, height: 700 });
        const second = custom.create({ width: 320, height: 480 });
        expect(first.names).toEqual({
            tr: "Özel boyut 1",
            en: "Custom size 1",
        });
        expect(second.names.tr).toBe("Özel boyut 2");
        expect(first.category).toBe("custom");
        expect(first.id).not.toBe(second.id);
        expect(custom.list()).toHaveLength(2);
    });

    it("hazır cihazdan türetilenler kaynağın adını taşır", () => {
        const { custom } = setup();
        const iphone = findDevice("iphone-17");
        const a = custom.create({ width: 500, height: 874 }, iphone);
        const b = custom.create({ width: 600, height: 874 }, iphone);
        expect(a.names).toEqual({
            tr: "iPhone 17 (özel)",
            en: "iPhone 17 (custom)",
        });
        expect(b.names.tr).toBe("iPhone 17 (özel 2)");
        expect(a.sourceId).toBe("iphone-17");
        // Türetme ile Özel sekmesi numaraları birbirinden bağımsız
        expect(custom.create({ width: 300, height: 300 }).names.tr).toBe(
            "Özel boyut 1",
        );
    });

    it("boyutlandırır, yeniden adlandırır ve siler", () => {
        const { devices, custom } = setup();
        const device = custom.create({ width: 500, height: 700 });
        custom.resize(device.id, { width: 640, height: 480 });
        expect(device.screen).toEqual({ width: 640, height: 480 });
        custom.rename(device.id, "  Kiosk  ");
        expect(device.names).toEqual({ tr: "Kiosk", en: "Kiosk" });
        // Boş ad yok sayılır
        custom.rename(device.id, "   ");
        expect(device.names.tr).toBe("Kiosk");
        expect(custom.remove(device.id)).toBe(device);
        expect(custom.list()).toHaveLength(0);
        expect(devices).toHaveLength(1);
        // Hazır cihaz silinemez
        expect(custom.remove("iphone-17")).toBe(null);
    });

    it("aramada çıkar ve Özel sekmesine aittir", () => {
        const { devices, custom } = setup();
        const device = custom.create({ width: 500, height: 700 });
        expect(tabOf(device)).toBe("custom");
        const results = searchDevices(devices, "özel boyut");
        expect(results.map((g) => g.category)).toEqual(["custom"]);
    });
});
