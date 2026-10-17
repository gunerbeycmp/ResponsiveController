import { describe, expect, it } from "vitest";
import {
    DEFAULT_DEVICE_ID,
    DEVICES,
    deviceSize,
    findDevice,
    baseName,
    fitScale,
    foldSibling,
    isLandscape,
    rotatedFor,
    viewRenderSize,
    viewSize,
} from "../../app/src/devices/devices.js";

describe("cihaz verisi (Teknik Tasarım 6)", () => {
    it("her cihazın zorunlu alanları var", () => {
        for (const device of DEVICES) {
            expect(device.id).toBeTruthy();
            expect(
                device.name || (device.names?.tr && device.names?.en),
            ).toBeTruthy();
            expect([
                "phone",
                "tablet",
                "watch",
                "tv",
                "computer",
                "generic",
            ]).toContain(device.category);
            expect(device.screen.width).toBeGreaterThan(0);
            expect(device.screen.height).toBeGreaterThan(0);
            expect(typeof device.estimated).toBe("boolean");
            expect(device.source).toBeTruthy();
        }
    });

    it("kimlikler benzersiz ve varsayılan cihaz listede", () => {
        const ids = DEVICES.map((device) => device.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(DEFAULT_DEVICE_ID);
    });

    it("görünür alan, tam ekranla aynı genişlikte ve daha kısa (FR-3.14)", () => {
        for (const device of DEVICES.filter((d) => d.visibleArea)) {
            expect(device.visibleArea.width).toBe(device.screen.width);
            expect(device.visibleArea.height).toBeLessThan(
                device.screen.height,
            );
        }
    });

    it("çevrilen adlar iki dilde de var", () => {
        for (const device of DEVICES.filter((d) => d.names)) {
            expect(device.names.tr).toBeTruthy();
            expect(device.names.en).toBeTruthy();
        }
    });

    it("onaylanan listeyle aynı sayıda cihaz var (93)", () => {
        expect(DEVICES.filter((d) => !d.generated)).toHaveLength(93);
    });

    it("katlanabilir hâller ikişer, açık ve katlı", () => {
        const groups = Object.groupBy(
            DEVICES.filter((d) => d.foldable),
            (d) => d.foldable.group,
        );
        for (const items of Object.values(groups)) {
            expect(items.map((d) => d.foldable.state).sort()).toEqual([
                "folded",
                "open",
            ]);
        }
    });
});

describe("cihaz yardımcıları", () => {
    it("bilinmeyen kimlikte ilk cihazı döndürür", () => {
        expect(findDevice("yok").id).toBe(DEVICES[0].id);
    });

    it("görünür alan yalnızca değeri varsa kullanılır", () => {
        const phone = findDevice("iphone-17");
        const desktop = findDevice("1920-x-1080");
        expect(deviceSize(phone, true)).toEqual(phone.visibleArea);
        expect(deviceSize(phone, false)).toEqual(phone.screen);
        expect(deviceSize(desktop, true)).toEqual(desktop.screen);
    });

    it("fitScale cihazı alana sığdırır ama büyütmez", () => {
        const size = { width: 1920, height: 1080 };
        expect(fitScale(size, { width: 960, height: 1000 })).toBe(0.5);
        expect(fitScale(size, { width: 4000, height: 4000 })).toBe(1);
        expect(fitScale(size, { width: 0, height: 500 })).toBe(1);
    });
});

describe("döndürme (FR-3.6, R-62)", () => {
    const iphone = findDevice("iphone-17");
    const desktop = findDevice("1920-x-1080");

    it("döndürülen cihazın genişliği ve yüksekliği yer değiştirir", () => {
        expect(viewSize(iphone)).toEqual({ width: 402, height: 874 });
        expect(viewSize(iphone, { rotated: true })).toEqual({
            width: 874,
            height: 402,
        });
        expect(isLandscape(viewSize(desktop))).toBe(true);
    });

    it("tarayıcı çubukları yalnızca döndürülmemiş cihazda uygulanır", () => {
        expect(viewSize(iphone, { browserBars: true })).toEqual(
            iphone.visibleArea,
        );
        expect(viewSize(iphone, { rotated: true, browserBars: true })).toEqual({
            width: 874,
            height: 402,
        });
    });

    it("Apple Watch çizim boyutu da döner", () => {
        const watch = findDevice("apple-watch-44-mm");
        expect(viewRenderSize(watch, { rotated: true })).toEqual({
            width: 390,
            height: 320,
        });
    });

    it("istenen konum için döndürme gerekip gerekmediğini bulur", () => {
        expect(rotatedFor(iphone, true)).toBe(true);
        expect(rotatedFor(iphone, false)).toBe(false);
        expect(rotatedFor(desktop, true)).toBe(false);
        expect(rotatedFor(desktop, false)).toBe(true);
        // Kare ekran hiç döndürülmez
        expect(rotatedFor(findDevice("galaxy-watch"), true)).toBe(false);
    });
});

describe("katlanabilir telefonlar (FR-3.5)", () => {
    it("diğer hâli bulur", () => {
        const open = findDevice("galaxy-z-fold-7-open");
        expect(foldSibling(open).id).toBe("galaxy-z-fold-7-folded");
        expect(foldSibling(foldSibling(open)).id).toBe(open.id);
        expect(foldSibling(findDevice("iphone-17"))).toBe(null);
    });

    it("hâl eki olmadan ad verir", () => {
        const folded = findDevice("galaxy-z-flip-7-folded");
        expect(baseName(folded, "tr")).toBe("Galaxy Z Flip 7");
        expect(baseName(folded, "en")).toBe("Galaxy Z Flip 7");
        expect(baseName(findDevice("iphone-17"))).toBe("iPhone 17");
    });
});
