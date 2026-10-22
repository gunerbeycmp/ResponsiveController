import { describe, expect, it } from "vitest";
import { DEVICES, findDevice } from "../../app/src/devices/devices.js";
import {
    frameSpec,
    hasFrame,
    outerSize,
    radii,
} from "../../app/src/devices/frames.js";
import { createGridStore } from "../../app/src/grid/store.js";

const device = (id) => {
    const found = findDevice(id);
    expect(found.id).toBe(id);
    return found;
};

describe("hasFrame", () => {
    it("telefon, tablet, saat, TV ve dizüstünde var", () => {
        for (const id of [
            "iphone-17",
            "galaxy-s25",
            "ipad-pro-11-m4",
            "apple-watch-44-mm",
            "tv-full-hd",
            "macbook-pro-14",
        ])
            expect(hasFrame(device(id))).toBe(true);
    });

    it("genel boyutlarda, çözünürlüklerde ve özel boyutlarda yok", () => {
        expect(hasFrame(device("small-phone"))).toBe(false);
        expect(hasFrame(device("1920-x-1080"))).toBe(false);
        expect(
            hasFrame({
                id: "custom-1",
                custom: true,
                category: "custom",
                screen: { width: 500, height: 800 },
            }),
        ).toBe(false);
        const generated = DEVICES.find((item) => item.generated);
        expect(hasFrame(generated)).toBe(false);
    });
});

describe("kamera biçimi", () => {
    const cutout = (id) => frameSpec(device(id)).cutout;

    it("Dynamic Island, çentik ve delik", () => {
        expect(cutout("iphone-17")).toBe("island");
        expect(cutout("iphone-17-pro-max")).toBe("island");
        expect(cutout("iphone-14-pro")).toBe("island");
        expect(cutout("iphone-14")).toBe("notch");
        expect(cutout("iphone-16e")).toBe("notch");
        expect(cutout("iphone-13-mini")).toBe("notch");
        expect(cutout("galaxy-s25")).toBe("hole");
        expect(cutout("iphone-se-3rd-gen")).toBe("home");
    });

    it("çentikli MacBook'lar ve diğer dizüstüler", () => {
        expect(cutout("macbook-pro-14")).toBe("notch");
        expect(cutout("surface-laptop")).toBe("camera");
        expect(frameSpec(device("surface-pro")).kind).toBe("tablet");
    });

    it("yuvarlak ekranlı saat", () => {
        const spec = frameSpec(device("galaxy-watch"));
        expect(spec.round).toBe(true);
        expect(radii(spec, 1)).toEqual({ screen: "50%", outer: "50%" });
    });
});

describe("frameSpec döndürme", () => {
    it("kasa saat yönünde döner, ekler kalkar", () => {
        const laptop = device("macbook-pro-14");
        const upright = frameSpec(laptop);
        const turned = frameSpec(laptop, { rotated: true });
        expect(upright.extra.bottom).toBeGreaterThan(0);
        expect(turned.extra).toEqual({ top: 0, bottom: 0, side: 0 });
        expect(turned.bezel.left).toBe(upright.bezel.bottom);
        expect(turned.bezel.right).toBe(upright.bezel.top);
        expect(turned.bezel.top).toBe(upright.bezel.left);
        expect(turned.rotated).toBe(true);
    });
});

describe("outerSize", () => {
    it("kasa ve ekler eklenir; çerçevesizde ekran boyutu", () => {
        const size = { width: 402, height: 874 };
        expect(outerSize(size, null)).toEqual(size);
        expect(outerSize(size, frameSpec(device("iphone-17")))).toEqual({
            width: 426,
            height: 898,
        });
        const watch = frameSpec(device("apple-watch-44-mm"));
        expect(outerSize({ width: 184, height: 224 }, watch)).toEqual({
            width: 184 + 24,
            height: 224 + 24 + 140,
        });
    });
});

describe("ızgara deposu: gerçekçi çerçeve", () => {
    const memory = () => {
        const values = new Map();
        return {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
        };
    };

    it("cihaza bağlı saklanır ve geri okunur", () => {
        const storage = memory();
        const store = createGridStore({ storage });
        expect(store.isFramed("iphone-17")).toBe(false);
        store.setFramed("iphone-17", true);
        store.setFramed("iphone-17", true);
        expect(JSON.parse(storage.getItem("rc-grid")).framed).toEqual([
            "iphone-17",
        ]);
        expect(createGridStore({ storage }).isFramed("iphone-17")).toBe(true);
        store.setFramed("iphone-17", false);
        expect(createGridStore({ storage }).isFramed("iphone-17")).toBe(false);
    });

    it("bilinmeyen cihazlar ve eski kayıtlar", () => {
        const storage = memory();
        storage.setItem(
            "rc-grid",
            JSON.stringify({ ids: [], framed: ["yok", "iphone-17"] }),
        );
        const store = createGridStore({
            storage,
            isKnown: (id) => id !== "yok",
        });
        expect(store.isFramed("iphone-17")).toBe(true);
        expect(store.isFramed("yok")).toBe(false);
        storage.setItem("rc-grid", JSON.stringify({ ids: [] }));
        expect(createGridStore({ storage }).isFramed("iphone-17")).toBe(false);
    });
});
