import { describe, expect, it } from "vitest";
import {
    DEVICES,
    deviceName,
    renderSize,
    findDevice,
} from "../../app/src/devices/devices.js";
import {
    TABS,
    buildTab,
    searchDevices,
    tabOf,
} from "../../app/src/devices/menu.js";

const names = (items) => items.map((d) => deviceName(d, "tr"));

describe("buildTab (FR-3.1, FR-3.3, FR-3.4)", () => {
    it("her sekme Popüler ile başlar ve Genel boyutlarla biter", () => {
        for (const tab of ["phone", "tablet", "computer"]) {
            const groups = buildTab(DEVICES, tab);
            expect(groups[0].type).toBe("popular");
            expect(groups.at(-1).type).toBe("generic");
            expect(groups.at(-1).items).toHaveLength(6);
        }
    });

    it("telefonlar markaya göre ve belirli sırayla gruplanır", () => {
        const brands = buildTab(DEVICES, "phone")
            .filter((g) => g.type === "brand")
            .map((g) => g.brand);
        expect(brands).toEqual(["Apple", "Samsung", "Google", "OnePlus"]);
    });

    it("katlanabilir telefonlar Samsung grubunda", () => {
        const samsung = buildTab(DEVICES, "phone").find(
            (g) => g.brand === "Samsung",
        );
        expect(names(samsung.items)).toContain("Galaxy Z Fold 7 · Açık");
        expect(names(samsung.items)).toContain("Galaxy Z Flip 6 · Katlı");
    });

    it("bilgisayar sekmesinde çözünürlük satırları ve altında cihazlar", () => {
        const { rows } = buildTab(DEVICES, "computer").find(
            (g) => g.type === "resolutions",
        );
        const row1440 = rows.find((r) => r.resolution.screen.width === 1440);
        expect(names(row1440.devices)).toEqual([
            "MacBook Air / Pro 13 (2560 × 1600 ekran)",
        ]);
        // Cihaza özgü çözünürlük için satır üretilir
        const row1512 = rows.find((r) => r.resolution.screen.width === 1512);
        expect(row1512.resolution.generated).toBe(true);
        expect(names(row1512.devices)).toEqual(["MacBook Pro 14"]);
        // Satırlar genişliğe göre sıralı
        const widths = rows.map((r) => r.resolution.screen.width);
        expect(widths).toEqual([...widths].sort((a, b) => a - b));
    });

    it("tüm cihazlar bir sekmede ya da genel boyutlarda görünür", () => {
        const shown = new Set();
        for (const tab of TABS) {
            for (const group of buildTab(DEVICES, tab)) {
                for (const item of group.items ?? []) shown.add(item.id);
                for (const row of group.rows ?? []) {
                    shown.add(row.resolution.id);
                    row.devices.forEach((d) => shown.add(d.id));
                }
            }
        }
        expect(DEVICES.filter((d) => !shown.has(d.id))).toEqual([]);
    });
});

describe("searchDevices", () => {
    it("ad, marka ve boyutla arar; büyük/küçük harf ve Türkçe karakter fark etmez", () => {
        expect(names(searchDevices(DEVICES, "iphone 16 pro")[0].items)).toEqual(
            ["iPhone 16 Pro Max", "iPhone 16 Pro"],
        );
        expect(
            searchDevices(DEVICES, "SAMSUNG").map((g) => g.category),
        ).toEqual(["phone", "tablet", "watch"]);
        expect(
            names(
                searchDevices(DEVICES, "1920 x 1080").flatMap((g) => g.items),
            ),
        ).toContain("TV (Full HD)");
        expect(
            names(searchDevices(DEVICES, "kucuk").flatMap((g) => g.items)),
        ).toEqual(["Küçük telefon"]);
        expect(searchDevices(DEVICES, "11th gen")[0].items[0].id).toBe(
            findDevice("ipad-11th-gen").id,
        );
    });

    it("eşleşme yoksa boş liste döner", () => {
        expect(searchDevices(DEVICES, "nokia 3310")).toEqual([]);
        expect(searchDevices(DEVICES, "   ")).toEqual([]);
    });
});

describe("cihaz yardımcıları", () => {
    it("adı seçili dilde verir", () => {
        const ipad = findDevice("ipad-11th-gen");
        expect(deviceName(ipad, "tr")).toBe("iPad (11. nesil)");
        expect(deviceName(ipad, "en")).toBe("iPad (11th gen)");
        expect(deviceName(findDevice("iphone-17"), "en")).toBe("iPhone 17");
    });

    it("Apple Watch 320 px genişlikte çizilir", () => {
        expect(renderSize(findDevice("apple-watch-44-mm"), false)).toEqual({
            width: 320,
            height: 390,
        });
        expect(renderSize(findDevice("iphone-17"), true)).toEqual({
            width: 402,
            height: 681,
        });
    });

    it("sekmesi olmayan genel boyutlar Telefon sekmesine düşer", () => {
        expect(tabOf(findDevice("small-phone"))).toBe("phone");
        expect(tabOf(findDevice("macbook-pro-14"))).toBe("computer");
    });
});
