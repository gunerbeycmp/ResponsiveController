import { describe, expect, it } from "vitest";
import {
    FAVORITES_STORAGE_KEY,
    createFavorites,
} from "../../app/src/devices/favorites.js";

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

const stored = (storage) => JSON.parse(storage.data[FAVORITES_STORAGE_KEY]);

describe("favoriler (FR-3.2)", () => {
    it("başlangıçta boş", () => {
        const favorites = createFavorites({ storage: fakeStorage() });
        expect(favorites.list()).toEqual([]);
        expect(favorites.frequent()).toEqual([]);
    });

    it("ekler, çıkarır ve ekleme sırasını saklar", () => {
        const storage = fakeStorage();
        const favorites = createFavorites({ storage });
        expect(favorites.toggle("a")).toBe(true);
        expect(favorites.toggle("b")).toBe(true);
        expect(favorites.has("a")).toBe(true);
        expect(stored(storage).ids).toEqual(["a", "b"]);
        expect(favorites.toggle("a")).toBe(false);
        expect(favorites.list()).toEqual(["b"]);
    });

    it("saklanan favorileri okur, bilinmeyen ve bozuk değerleri atlar", () => {
        const storage = fakeStorage({
            [FAVORITES_STORAGE_KEY]: JSON.stringify({
                ids: ["a", "x", "b", "a", 5],
                frequent: ["b", "x", "c"],
            }),
        });
        const favorites = createFavorites({
            storage,
            isKnown: (id) => ["a", "b", "c"].includes(id),
        });
        expect(favorites.list()).toEqual(["a", "b"]);
        // Favoride olmayan cihaz sık kullanılanlarda olamaz
        expect(favorites.frequent()).toEqual(["b"]);
    });

    it("bozuk kayıtta ve depolama hatasında boş başlar", () => {
        const broken = fakeStorage({ [FAVORITES_STORAGE_KEY]: "{oops" });
        expect(createFavorites({ storage: broken }).list()).toEqual([]);
        const throwing = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        };
        const favorites = createFavorites({ storage: throwing });
        expect(() => favorites.toggle("a")).not.toThrow();
        expect(favorites.list()).toEqual(["a"]);
    });

    it("sık kullanılanlara taşır ve sırayı değiştirir", () => {
        const storage = fakeStorage();
        const favorites = createFavorites({ storage });
        for (const id of ["a", "b", "c"]) favorites.toggle(id);
        favorites.moveToFrequent("b");
        favorites.moveToFrequent("c");
        expect(favorites.frequent()).toEqual(["b", "c"]);
        favorites.moveToFrequent("c", 0);
        expect(favorites.frequent()).toEqual(["c", "b"]);
        favorites.moveToFrequent("a", 1);
        expect(favorites.frequent()).toEqual(["c", "a", "b"]);
        // Sınır dışı sıralar listenin başına ya da sonuna yerleşir
        favorites.moveToFrequent("c", 99);
        expect(favorites.frequent()).toEqual(["a", "b", "c"]);
        favorites.moveToFrequent("c", -1);
        expect(favorites.frequent()).toEqual(["c", "a", "b"]);
        expect(stored(storage).frequent).toEqual(["c", "a", "b"]);
        expect(favorites.isFrequent("a")).toBe(true);
    });

    it("favoride olmayan cihaz sık kullanılanlara eklenmez", () => {
        const favorites = createFavorites({ storage: fakeStorage() });
        favorites.moveToFrequent("a");
        expect(favorites.frequent()).toEqual([]);
    });

    it("sık kullanılanlardan çıkarır; favoriden çıkan cihaz oradan da çıkar", () => {
        const favorites = createFavorites({ storage: fakeStorage() });
        for (const id of ["a", "b"]) {
            favorites.toggle(id);
            favorites.moveToFrequent(id);
        }
        favorites.removeFromFrequent("a");
        expect(favorites.frequent()).toEqual(["b"]);
        expect(favorites.has("a")).toBe(true);
        favorites.toggle("b");
        expect(favorites.frequent()).toEqual([]);
    });
});
