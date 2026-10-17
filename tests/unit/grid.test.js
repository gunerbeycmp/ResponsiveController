import { describe, expect, it } from "vitest";
import { createFpsMonitor } from "../../app/src/grid/fps.js";
import { GRID_STORAGE_KEY, createGridStore } from "../../app/src/grid/store.js";
import {
    MAX_ZOOM,
    clampZoom,
    minZoom,
    zoomIn,
    zoomOut,
} from "../../app/src/grid/zoom.js";

function fakeStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: (key) => data[key] ?? null,
        setItem: (key, value) => {
            data[key] = value;
        },
        data,
    };
}

describe("ızgara deposu (FR-3.7)", () => {
    it("varsayılan: boş, tek cihaz modu, orta kutu", () => {
        const store = createGridStore({ storage: fakeStorage() });
        expect(store.list()).toEqual([]);
        expect(store.getMode()).toBe("single");
        expect(store.getSize()).toBe("medium");
    });

    it("ekler, sıralar, çıkarır ve saklar", () => {
        const storage = fakeStorage();
        const store = createGridStore({ storage });
        store.add("a");
        store.add("b");
        store.add("c", 0);
        expect(store.list()).toEqual(["c", "a", "b"]);
        // Var olan cihaz eklenince yeni sırasına taşınır, tekrar etmez
        store.add("c", 2);
        expect(store.list()).toEqual(["a", "b", "c"]);
        store.remove("b");
        store.setMode("grid");
        store.setSize("large");
        expect(JSON.parse(storage.data[GRID_STORAGE_KEY])).toEqual({
            ids: ["a", "c"],
            mode: "grid",
            size: "large",
            rotated: [],
            scale: null,
        });
        expect(store.has("a")).toBe(true);
        expect(store.has("b")).toBe(false);
    });

    it("geçersiz mod ve boyutları yok sayar", () => {
        const store = createGridStore({ storage: fakeStorage() });
        store.setMode("tablo");
        store.setSize("dev");
        expect(store.getMode()).toBe("single");
        expect(store.getSize()).toBe("medium");
    });

    it("saklananı okur; bilinmeyen ve bozuk değerleri atlar", () => {
        const storage = fakeStorage({
            [GRID_STORAGE_KEY]: JSON.stringify({
                ids: ["a", "x", "a", 3],
                mode: "grid",
                size: "dev",
            }),
        });
        const store = createGridStore({
            storage,
            isKnown: (id) => id === "a",
        });
        expect(store.list()).toEqual(["a"]);
        expect(store.getMode()).toBe("grid");
        expect(store.getSize()).toBe("medium");
        const broken = fakeStorage({ [GRID_STORAGE_KEY]: "{oops" });
        expect(createGridStore({ storage: broken }).list()).toEqual([]);
    });

    it("depolama hatasında çalışmaya devam eder", () => {
        const throwing = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        };
        const store = createGridStore({ storage: throwing });
        expect(() => store.add("a")).not.toThrow();
        expect(store.list()).toEqual(["a"]);
    });
});

describe("döndürme ve genel ölçek (FR-3.6, FR-3.9)", () => {
    it("döndürülen cihazları ve genel ölçeği saklar", () => {
        const storage = fakeStorage();
        const store = createGridStore({ storage });
        store.setRotated("a", true);
        store.setRotated("a", true);
        store.setRotated("b", true);
        store.setRotated("b", false);
        expect(store.isRotated("a")).toBe(true);
        expect(store.isRotated("b")).toBe(false);
        expect(store.getScale()).toBe(null);
        store.setScale(1.5);
        const saved = JSON.parse(storage.data[GRID_STORAGE_KEY]);
        expect(saved.rotated).toEqual(["a"]);
        expect(saved.scale).toBe(1.5);
        // Sınır dışı değerler sınıra çekilir, null Sığdır'dır
        store.setScale(9);
        expect(store.getScale()).toBe(2);
        store.setScale(0.01);
        expect(store.getScale()).toBe(0.25);
        store.setScale(null);
        expect(store.getScale()).toBe(null);
    });

    it("geçersiz saklanan ölçeği ve bilinmeyen döndürmeleri atlar", () => {
        const storage = fakeStorage({
            [GRID_STORAGE_KEY]: JSON.stringify({
                ids: [],
                rotated: ["a", "x"],
                scale: 7,
            }),
        });
        const store = createGridStore({
            storage,
            isKnown: (id) => id === "a",
        });
        expect(store.isRotated("a")).toBe(true);
        expect(store.isRotated("x")).toBe(false);
        expect(store.getScale()).toBe(null);
    });
});

describe("kutu içi yakınlaştırma (FR-3.9)", () => {
    it("adımlarla yakınlaşır ve en fazla %200 olur", () => {
        expect(zoomIn(0.43)).toBe(0.5);
        expect(zoomIn(0.5)).toBe(0.75);
        expect(zoomIn(1.5)).toBe(2);
        expect(zoomIn(2)).toBe(MAX_ZOOM);
    });

    it("adımlarla uzaklaşır, en küçük adımın ya da Sığdır'ın altına inmez", () => {
        expect(zoomOut(1, 0.43)).toBe(0.75);
        expect(zoomOut(0.5, 0.43)).toBe(0.25);
        expect(zoomOut(0.25, 0.43)).toBe(0.25);
        // Sığdır ölçeği en küçük adımdan küçükse oraya kadar iner
        expect(zoomOut(0.25, 0.12)).toBe(0.12);
        expect(minZoom(0.12)).toBe(0.12);
    });

    it("kesintisiz ölçeği sınırlar içinde tutar", () => {
        expect(clampZoom(5, 0.4)).toBe(2);
        expect(clampZoom(0.01, 0.4)).toBe(0.25);
        expect(clampZoom(0.6, 0.4)).toBe(0.6);
    });
});

// Sahte saat: her kare frameMs milisaniye sürer
function fakeClock(frameMs) {
    let time = 0;
    let pending = null;
    return {
        now: () => time,
        requestFrame: (callback) => {
            pending = callback;
            return 1;
        },
        cancelFrame: () => {
            pending = null;
        },
        run(ms, step = frameMs) {
            const end = time + ms;
            while (time < end && pending) {
                time += step;
                const callback = pending;
                pending = null;
                callback();
            }
        },
    };
}

describe("yavaşlama ölçümü (FR-3.8, Teknik Tasarım 7.2)", () => {
    it("3 saniye 30 FPS altında kalınca bir kez bildirir", () => {
        const clock = fakeClock(50); // 20 FPS
        const slow = [];
        const monitor = createFpsMonitor({
            onSlow: (fps) => slow.push(fps),
            ...clock,
        });
        monitor.start();
        clock.run(2500);
        expect(slow).toHaveLength(0);
        clock.run(2000);
        expect(slow).toHaveLength(1);
        expect(slow[0]).toBeLessThan(30);
        clock.run(5000);
        expect(slow).toHaveLength(1);
    });

    it("akıcı çalışmada bildirmez", () => {
        const clock = fakeClock(16); // ~60 FPS
        const slow = [];
        const monitor = createFpsMonitor({
            onSlow: () => slow.push(1),
            ...clock,
        });
        monitor.start();
        clock.run(10000);
        expect(slow).toHaveLength(0);
    });

    it("reset sonrası yeniden bildirebilir, stop ölçümü durdurur", () => {
        const clock = fakeClock(50);
        const slow = [];
        const monitor = createFpsMonitor({
            onSlow: () => slow.push(1),
            ...clock,
        });
        monitor.start();
        clock.run(5000);
        monitor.reset();
        clock.run(5000);
        expect(slow).toHaveLength(2);
        monitor.stop();
        expect(monitor.isRunning()).toBe(false);
    });
});
