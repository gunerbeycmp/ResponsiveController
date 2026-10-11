import { describe, expect, it } from "vitest";
import {
    STORAGE_KEY,
    createI18n,
    detectLanguage,
} from "../../app/src/i18n/i18n.js";

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

const brokenStorage = {
    getItem: () => {
        throw new Error("storage kapalı");
    },
    setItem: () => {
        throw new Error("storage kapalı");
    },
};

describe("detectLanguage (NFR-4.2)", () => {
    it("tarayıcı Türkçe ise Türkçe seçer", () => {
        expect(detectLanguage(["tr-TR", "en-US"])).toBe("tr");
        expect(detectLanguage(["tr"])).toBe("tr");
    });

    it("tarayıcı Türkçe değilse İngilizce seçer", () => {
        expect(detectLanguage(["en-US", "tr-TR"])).toBe("en");
        expect(detectLanguage(["de-DE"])).toBe("en");
        expect(detectLanguage([])).toBe("en");
    });
});

describe("createI18n", () => {
    it("saklanan dil tarayıcı dilinden önce gelir (NFR-4.3)", () => {
        const i18n = createI18n({
            storage: fakeStorage({ [STORAGE_KEY]: "en" }),
            browserLanguages: ["tr-TR"],
        });
        expect(i18n.getLanguage()).toBe("en");
    });

    it("geçersiz saklanan değeri yok sayar", () => {
        const i18n = createI18n({
            storage: fakeStorage({ [STORAGE_KEY]: "fr" }),
            browserLanguages: ["tr-TR"],
        });
        expect(i18n.getLanguage()).toBe("tr");
    });

    it("seçilen dili saklar ve sayfanın lang özelliğini günceller", () => {
        const storage = fakeStorage();
        const root = { lang: "" };
        const i18n = createI18n({
            storage,
            browserLanguages: ["tr-TR"],
            root,
        });
        expect(root.lang).toBe("tr");

        i18n.setLanguage("en");
        expect(i18n.getLanguage()).toBe("en");
        expect(storage.data[STORAGE_KEY]).toBe("en");
        expect(root.lang).toBe("en");
    });

    it("desteklenmeyen dile geçmez", () => {
        const i18n = createI18n({ browserLanguages: ["tr-TR"] });
        i18n.setLanguage("fr");
        expect(i18n.getLanguage()).toBe("tr");
    });

    it("depolama hata verse de çalışır", () => {
        const i18n = createI18n({
            storage: brokenStorage,
            browserLanguages: ["tr-TR"],
        });
        expect(i18n.getLanguage()).toBe("tr");
        expect(() => i18n.setLanguage("en")).not.toThrow();
        expect(i18n.getLanguage()).toBe("en");
    });

    it("metni seçili dilde döndürür, yoksa İngilizceye, o da yoksa anahtara düşer", () => {
        const i18n = createI18n({
            browserLanguages: ["tr-TR"],
            messages: {
                tr: { greeting: "Merhaba" },
                en: { greeting: "Hello", onlyEnglish: "English only" },
            },
        });
        expect(i18n.t("greeting")).toBe("Merhaba");
        expect(i18n.t("onlyEnglish")).toBe("English only");
        expect(i18n.t("missing.key")).toBe("missing.key");
    });

    it("yer tutucuları doldurur", () => {
        const i18n = createI18n({
            browserLanguages: ["tr-TR"],
            messages: { tr: { size: "{width} × {height}" }, en: {} },
        });
        expect(i18n.t("size", { width: 402, height: 874 })).toBe("402 × 874");
        expect(i18n.t("size", { width: 402 })).toBe("402 × {height}");
    });

    it("tr.json ve en.json aynı anahtarlara sahip", async () => {
        const tr = (await import("../../app/src/i18n/tr.json")).default;
        const en = (await import("../../app/src/i18n/en.json")).default;
        expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
    });
});
