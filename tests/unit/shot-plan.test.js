import { describe, expect, it } from "vitest";
import {
    canvasLimits,
    fitScale,
    partPlan,
} from "../../preview/public/__rc/shot-plan.js";
import { matchesWindow, visibleRect } from "../../app/src/shot/screen.js";

const CHROME =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const SAFARI =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

describe("tam sayfa çizim sınırı (R-64)", () => {
    it("Safari'de alan sınırı daha küçüktür", () => {
        expect(canvasLimits(CHROME)).toEqual({ side: 16384, area: 268435456 });
        expect(canvasLimits(SAFARI)).toEqual({ side: 16384, area: 16777216 });
    });

    it("sınıra sığan sayfada yoğunluk değişmez", () => {
        const limits = canvasLimits(CHROME);
        expect(
            fitScale({ width: 402, height: 3000, scale: 3, limits }),
        ).toEqual({ scale: 3, reduced: false });
    });

    it("uzun sayfada yoğunluk 0,1 adımla düşürülür", () => {
        const limits = canvasLimits(CHROME);
        // 16384 / 6000 = 2,73 → 2,7
        expect(
            fitScale({ width: 402, height: 6000, scale: 3, limits }),
        ).toEqual({ scale: 2.7, reduced: true });
        // Safari'de alan sınırı belirleyici: √(16777216 / (402 × 6000)) = 2,63
        expect(
            fitScale({
                width: 402,
                height: 6000,
                scale: 3,
                limits: canvasLimits(SAFARI),
            }),
        ).toEqual({ scale: 2.6, reduced: true });
    });

    it("parçalar tam yoğunlukta sınıra sığan dilimlere bölünür", () => {
        const limits = canvasLimits(CHROME);
        // 16384 / 3 = 5461 px'lik dilimler
        expect(
            partPlan({ width: 402, height: 6000, scale: 3, limits }),
        ).toEqual([
            { top: 0, height: 5461 },
            { top: 5461, height: 539 },
        ]);
        const parts = partPlan({
            width: 402,
            height: 20000,
            scale: 3,
            limits: canvasLimits(SAFARI),
        });
        for (const part of parts)
            expect(402 * 3 * part.height * 3).toBeLessThanOrEqual(16777216);
        expect(parts.reduce((sum, part) => sum + part.height, 0)).toBe(20000);
    });
});

describe("ekran paylaşımı (FR-4.2)", () => {
    it("paylaşılan karenin bu sekmeye ait olup olmadığını oranla anlar", () => {
        const view = { width: 1280, height: 800 };
        expect(matchesWindow({ width: 2560, height: 1600 }, view)).toBe(true);
        expect(matchesWindow({ width: 1280, height: 790 }, view)).toBe(true);
        expect(matchesWindow({ width: 1920, height: 1080 }, view)).toBe(false);
    });

    it("kesilecek alan pencerenin içinde kalır", () => {
        const view = { width: 1280, height: 800 };
        expect(
            visibleRect(
                { left: 100, top: 700, right: 400, bottom: 1200 },
                view,
            ),
        ).toEqual({ left: 100, top: 700, width: 300, height: 100 });
        expect(
            visibleRect(
                { left: 100, top: 900, right: 400, bottom: 1200 },
                view,
            ),
        ).toBe(null);
    });
});
