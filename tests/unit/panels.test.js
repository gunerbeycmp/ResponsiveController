import { describe, expect, it } from "vitest";
import { PANELS_STORAGE_KEY, readPanels } from "../../app/src/ui/panels.js";

const memory = (value) => ({
    getItem: (key) => (key === PANELS_STORAGE_KEY ? value : null),
});

describe("panellerin durumu", () => {
    it("kayıt yoksa ikisi de açık", () => {
        expect(readPanels(memory(null))).toEqual({ devices: true, view: true });
    });

    it("kayıttaki durum okunur, geçersiz değerler yok sayılır", () => {
        expect(
            readPanels(memory(JSON.stringify({ devices: false, view: "x" }))),
        ).toEqual({ devices: false, view: true });
        expect(readPanels(memory("{"))).toEqual({ devices: true, view: true });
        const broken = {
            getItem() {
                throw new Error("kapalı");
            },
        };
        expect(readPanels(broken)).toEqual({ devices: true, view: true });
    });
});
