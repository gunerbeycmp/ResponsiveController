import { describe, expect, it } from "vitest";
import { openSizedWindow, popupFeatures } from "../../app/src/url/popup.js";

describe("popupFeatures (FR-2.3)", () => {
    it("cihaz boyutunda bir açılır pencere ister", () => {
        expect(popupFeatures({ width: 402, height: 874 })).toBe(
            "popup,width=402,height=874",
        );
    });

    it("ondalıklı boyutları yuvarlar", () => {
        expect(popupFeatures({ width: 402.4, height: 680.6 })).toBe(
            "popup,width=402,height=681",
        );
    });

    it("boyutları yok saydırabildiği için noopener içermez", () => {
        expect(popupFeatures({ width: 1, height: 1 })).not.toContain(
            "noopener",
        );
    });
});

describe("openSizedWindow", () => {
    it("pencereyi açar ve araca olan bağlantısını keser", () => {
        const opened = { opener: "araç" };
        const calls = [];
        const target = {
            open: (...args) => {
                calls.push(args);
                return opened;
            },
        };
        expect(
            openSizedWindow(
                "https://ornek.com/",
                { width: 402, height: 874 },
                target,
            ),
        ).toBe(opened);
        expect(calls[0]).toEqual([
            "https://ornek.com/",
            "_blank",
            "popup,width=402,height=874",
        ]);
        expect(opened.opener).toBeNull();
    });

    it("pencere engellenirse hata vermez", () => {
        const target = { open: () => null };
        expect(
            openSizedWindow(
                "https://ornek.com/",
                { width: 1, height: 1 },
                target,
            ),
        ).toBeNull();
    });
});
