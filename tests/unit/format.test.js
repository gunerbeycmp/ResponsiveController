import { describe, expect, it } from "vitest";
import { partFileName } from "../../app/src/shot/capture.js";
import {
    FORMATS,
    FORMAT_STORAGE_KEY,
    readFormat,
    writeFormat,
} from "../../app/src/shot/format.js";

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

describe("ekran görüntüsü biçimi (FR-4.5)", () => {
    it("ilk kullanımda PNG, sonra son seçim", () => {
        const storage = fakeStorage();
        expect(readFormat(storage)).toBe("png");
        writeFormat(storage, "jpeg");
        expect(storage.data[FORMAT_STORAGE_KEY]).toBe("jpeg");
        expect(readFormat(storage)).toBe("jpeg");
    });

    it("geçersiz değerde ve depolama hatasında PNG", () => {
        expect(readFormat(fakeStorage({ [FORMAT_STORAGE_KEY]: "gif" }))).toBe(
            "png",
        );
        const throwing = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        };
        expect(readFormat(throwing)).toBe("png");
        expect(() => writeFormat(throwing, "webp")).not.toThrow();
    });

    it("uzantılar ve parça adları", () => {
        expect(FORMATS.jpeg.extension).toBe("jpg");
        expect(FORMATS.webp.type).toBe("image/webp");
        expect(partFileName("parca", 0, "jpg")).toBe("parca-01.jpg");
        expect(partFileName("part", 11)).toBe("part-12.png");
    });
});
