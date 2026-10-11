import { describe, expect, it } from "vitest";
import { popupFeatures } from "../../app/src/url/popup.js";

describe("popupFeatures (FR-2.3)", () => {
    it("cihaz boyutunda, araca erişimi kapalı bir pencere ister", () => {
        expect(popupFeatures({ width: 402, height: 874 })).toBe(
            "popup,noopener,width=402,height=874",
        );
    });

    it("ondalıklı boyutları yuvarlar", () => {
        expect(popupFeatures({ width: 402.4, height: 680.6 })).toBe(
            "popup,noopener,width=402,height=681",
        );
    });
});
