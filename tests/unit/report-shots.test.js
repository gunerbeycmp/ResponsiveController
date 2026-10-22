import { describe, expect, it } from "vitest";
import { createShotStore } from "../../app/src/notes/shots.js";
import { markStyle } from "../../app/src/shot/markup.js";

describe("rapor görüntüleri deposu (FR-5.1)", () => {
    // IndexedDB yokken (ör. depolama kapalı) bellekte çalışır
    const create = () => createShotStore({ factory: null });

    it("bağlama göre ekler ve sırayla listeler", async () => {
        const store = await create();
        const a = await store.add({ context: "url:a", deviceId: "x", blob: 1 });
        await store.add({ context: "url:b", deviceId: "y", blob: 2 });
        const c = await store.add({
            context: "url:a",
            deviceId: null,
            blob: 3,
        });
        const list = await store.list("url:a");
        expect(list.map((shot) => shot.id)).toEqual([a.id, c.id]);
        expect(a.id).not.toBe(c.id);
        expect(await store.list(null)).toEqual([]);
    });

    it("kaldırır, temizler ve geri alır", async () => {
        const store = await create();
        const a = await store.add({ context: "url:a", blob: 1 });
        await store.add({ context: "url:a", blob: 2 });
        await store.remove(a.id);
        expect(await store.list("url:a")).toHaveLength(1);
        const removed = await store.clear("url:a");
        expect(await store.list("url:a")).toHaveLength(0);
        await store.restore(removed);
        expect(await store.list("url:a")).toHaveLength(1);
    });

    it("IndexedDB açılamazsa belleğe düşer", async () => {
        const broken = {
            open: () => {
                throw new Error("blocked");
            },
        };
        const store = await createShotStore({ factory: broken });
        await store.add({ context: "url:a", blob: 1 });
        expect(await store.list("url:a")).toHaveLength(1);
    });
});

describe("işaret kalınlığı (FR-5.3)", () => {
    it("görsel genişliğiyle orantılı, alt sınırlı", () => {
        expect(markStyle(300).line).toBe(3);
        expect(markStyle(1206).line).toBe(8);
        expect(markStyle(1206).outline).toBeGreaterThan(markStyle(1206).line);
        expect(markStyle(200).font).toBe(16);
    });
});
