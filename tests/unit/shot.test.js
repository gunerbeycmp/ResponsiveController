import { describe, expect, it } from "vitest";
import { shotFileName } from "../../app/src/shot/capture.js";

describe("ekran görüntüsü dosya adı (FR-4.1)", () => {
    const date = new Date(2026, 9, 21, 9, 5);

    it("cihaz, CSS boyutu, tarih ve saat içerir", () => {
        expect(
            shotFileName("iPhone 17", { width: 402, height: 874 }, { date }),
        ).toBe("iphone-17-402x874-2026-10-21-0905.png");
    });

    it("Türkçe karakterleri ve işaretleri sadeleştirir", () => {
        expect(
            shotFileName(
                "Galaxy Z Fold 7 · Açık",
                { width: 984, height: 1092 },
                { date },
            ),
        ).toBe("galaxy-z-fold-7-acik-984x1092-2026-10-21-0905.png");
        expect(
            shotFileName(
                "Büyük telefon (özel)",
                { width: 430, height: 932 },
                { date },
            ),
        ).toBe("buyuk-telefon-ozel-430x932-2026-10-21-0905.png");
        expect(
            shotFileName(
                "İç ekran ışığı",
                { width: 100, height: 100 },
                { date },
            ),
        ).toBe("ic-ekran-isigi-100x100-2026-10-21-0905.png");
    });
});
