import { beforeAll, describe, expect, it } from "vitest";

let core;
beforeAll(async () => {
    await import("../../preview/public/__rc/core.js");
    core = globalThis.RCCore;
});

describe("mimeType", () => {
    it("bilinen uzantılara doğru içerik türünü verir", () => {
        expect(core.mimeType("/index.html")).toContain("text/html");
        expect(core.mimeType("/a/style.CSS")).toContain("text/css");
        expect(core.mimeType("/app.js")).toContain("javascript");
        expect(core.mimeType("/logo.svg")).toBe("image/svg+xml");
        expect(core.mimeType("/font.woff2")).toBe("font/woff2");
    });

    it("bilinmeyen uzantıda genel ikili türü verir", () => {
        expect(core.mimeType("/veri.bin")).toBe("application/octet-stream");
    });
});

describe("normalizePath", () => {
    it("klasör adreslerine index.html ekler", () => {
        expect(core.normalizePath("/")).toBe("/index.html");
        expect(core.normalizePath("/blog/")).toBe("/blog/index.html");
    });

    it("yüzde kodlamalarını çözer", () => {
        expect(core.normalizePath("/g%C3%B6rsel%201.png")).toBe(
            "/görsel 1.png",
        );
        expect(core.normalizePath("/%E0%A4%A")).toBe("/%E0%A4%A");
    });
});

describe("resolveRequest (Teknik Tasarım 7.3)", () => {
    const files = new Set([
        "/index.html",
        "/assets/style.css",
        "/hakkinda/index.html",
    ]);
    const base = {
        hasFile: (path) => files.has(path),
        entry: "/index.html",
        isNavigation: false,
    };

    it("/__rc/ altındaki istekler ağa gider", () => {
        expect(
            core.resolveRequest({ ...base, pathname: "/__rc/sw.js" }),
        ).toEqual({ type: "network" });
    });

    it("projede olan dosyayı verir", () => {
        expect(core.resolveRequest({ ...base, pathname: "/" })).toEqual({
            type: "file",
            path: "/index.html",
        });
        expect(
            core.resolveRequest({ ...base, pathname: "/assets/style.css" }),
        ).toEqual({ type: "file", path: "/assets/style.css" });
    });

    it("uzantısız klasör adresinde klasörün index.html'ini verir", () => {
        expect(core.resolveRequest({ ...base, pathname: "/hakkinda" })).toEqual(
            { type: "file", path: "/hakkinda/index.html" },
        );
    });

    it("bulunamayan sayfa adresini başlangıç sayfasına yönlendirir", () => {
        expect(
            core.resolveRequest({
                ...base,
                pathname: "/urunler/12",
                isNavigation: true,
            }),
        ).toEqual({ type: "file", path: "/index.html" });
    });

    it("bulunamayan dosyayı yönlendirmez, 404 verir (R-42)", () => {
        expect(
            core.resolveRequest({ ...base, pathname: "/assets/yok.css" }),
        ).toEqual({ type: "notFound" });
    });
});
