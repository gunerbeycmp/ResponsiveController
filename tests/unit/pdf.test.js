import { describe, expect, it } from "vitest";
import {
    PAGE,
    QUALITY_STORAGE_KEY,
    displayWidth,
    readQuality,
    sliceImage,
    writeQuality,
} from "../../app/src/report/pdf.js";

const CONTENT = PAGE.width - PAGE.margin * 2;

const memory = () => {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
};

describe("PDF görsel kalitesi", () => {
    it("varsayılan küçük dosya, seçim saklanır", () => {
        const storage = memory();
        expect(readQuality(storage)).toBe("small");
        writeQuality(storage, "high");
        expect(storage.getItem(QUALITY_STORAGE_KEY)).toBe("high");
        expect(readQuality(storage)).toBe("high");
    });

    it("geçersiz değer ve kapalı depolama varsayılana döner", () => {
        const storage = memory();
        storage.setItem(QUALITY_STORAGE_KEY, "ultra");
        expect(readQuality(storage)).toBe("small");
        const broken = {
            getItem() {
                throw new Error("kapalı");
            },
            setItem() {
                throw new Error("kapalı");
            },
        };
        expect(readQuality(broken)).toBe("small");
        expect(() => writeQuality(broken, "high")).not.toThrow();
    });
});

describe("displayWidth", () => {
    it("yatay görsel tam genişlik, dikey görsel dar", () => {
        expect(displayWidth({ width: 1600, height: 900 })).toBe(CONTENT);
        expect(displayWidth({ width: 1206, height: 2622 })).toBeCloseTo(
            CONTENT * 0.55,
        );
    });

    it("küçük görsel büyütülmez", () => {
        expect(displayWidth({ width: 120, height: 300 })).toBe(120);
    });
});

describe("sliceImage", () => {
    it("kalan yere sığan görsel olduğu yerde", () => {
        expect(sliceImage(300, 400, 745)).toEqual([
            { top: 0, height: 300, newPage: false },
        ]);
    });

    it("tek sayfaya sığan görsel yeni sayfada, bölünmez", () => {
        expect(sliceImage(600, 400, 745)).toEqual([
            { top: 0, height: 600, newPage: true },
        ]);
    });

    it("uzun görsel kalan yerden başlayıp sayfalara bölünür", () => {
        const slices = sliceImage(1800, 400, 745);
        expect(slices).toEqual([
            { top: 0, height: 400, newPage: false },
            { top: 400, height: 745, newPage: true },
            { top: 1145, height: 655, newPage: true },
        ]);
    });

    it("kalan yer çok azsa bölünen görsel yeni sayfada başlar", () => {
        const slices = sliceImage(1800, 80, 745);
        expect(slices[0]).toEqual({ top: 0, height: 745, newPage: true });
        expect(slices.reduce((sum, slice) => sum + slice.height, 0)).toBe(1800);
    });
});
