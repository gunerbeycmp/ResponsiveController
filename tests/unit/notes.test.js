import { describe, expect, it } from "vitest";
import {
    NOTES_STORAGE_KEY,
    contextKey,
    createNotesStore,
} from "../../app/src/notes/store.js";

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

describe("not bağlamı (FR-5.3)", () => {
    it("adrese ya da proje adına göre", () => {
        expect(contextKey({ url: "https://ornek.com/menu?x=1#a" })).toBe(
            "url:https://ornek.com/menu",
        );
        expect(
            contextKey({ url: "http://localhost:5174/", project: "kafe.zip" }),
        ).toBe("project:kafe.zip");
        expect(contextKey({})).toBe(null);
    });
});

describe("not deposu (FR-5.3)", () => {
    it("genel ve cihaz notlarını bağlama göre saklar", () => {
        const storage = fakeStorage();
        const store = createNotesStore({ storage });
        store.setContext("url:a");
        store.setSession("Genel");
        store.setDevice("iphone-17", "Çentik");
        store.setContext("url:b");
        expect(store.getSession()).toBe("");
        expect(store.getDevice("iphone-17")).toBe("");
        store.setContext("url:a");
        expect(store.getSession()).toBe("Genel");
        expect(store.deviceIds()).toEqual(["iphone-17"]);
        expect(JSON.parse(storage.data[NOTES_STORAGE_KEY])).toEqual({
            "url:a": { session: "Genel", devices: { "iphone-17": "Çentik" } },
        });
        // Yeniden açılınca okunur
        const again = createNotesStore({ storage });
        again.setContext("url:a");
        expect(again.getDevice("iphone-17")).toBe("Çentik");
    });

    it("boş notlar saklanmaz", () => {
        const storage = fakeStorage();
        const store = createNotesStore({ storage });
        store.setContext("url:a");
        store.setDevice("x", "not");
        store.setDevice("x", "   ");
        expect(store.deviceIds()).toEqual([]);
        expect(JSON.parse(storage.data[NOTES_STORAGE_KEY])).toEqual({});
    });

    it("temizler ve geri alır", () => {
        const store = createNotesStore({ storage: fakeStorage() });
        store.setContext("url:a");
        store.setSession("Genel");
        store.setDevice("x", "not");
        const snapshot = store.clear();
        expect(store.getSession()).toBe("");
        expect(store.deviceIds()).toEqual([]);
        store.restore(snapshot);
        expect(store.getSession()).toBe("Genel");
        expect(store.getDevice("x")).toBe("not");
    });

    it("bağlam yokken yazılmaz, depolama hatasında çalışır", () => {
        const throwing = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        };
        const store = createNotesStore({ storage: throwing });
        store.setSession("x");
        expect(store.getSession()).toBe("");
        store.setContext("url:a");
        expect(() => store.setSession("Genel")).not.toThrow();
    });
});
