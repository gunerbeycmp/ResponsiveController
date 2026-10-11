import { describe, expect, it } from "vitest";
import {
    MAX_PROJECT_BYTES,
    UploadError,
    assertSize,
    classifyFile,
    resolveProject,
    toProjectPath,
} from "../../app/src/upload/project.js";

const file = (path) => ({ path, data: new ArrayBuffer(1) });
const paths = (project) => project.files.map((f) => f.path).sort();

describe("classifyFile (FR-1.1, FR-1.3)", () => {
    it("ZIP ve HTML dosyalarını tanır", () => {
        expect(classifyFile("proje.zip")).toBe("zip");
        expect(classifyFile("sayfa.HTML")).toBe("html");
        expect(classifyFile("eski.htm")).toBe("html");
    });

    it("diğer türleri reddeder", () => {
        expect(() => classifyFile("not.txt")).toThrow(UploadError);
        try {
            classifyFile("resim.png");
        } catch (error) {
            expect(error.reason).toBe("fileType");
        }
    });
});

describe("assertSize (FR-1.5)", () => {
    it("50 MB'a kadar kabul eder, fazlasını reddeder", () => {
        expect(() => assertSize(MAX_PROJECT_BYTES)).not.toThrow();
        expect(() => assertSize(MAX_PROJECT_BYTES + 1)).toThrow("tooLarge");
    });
});

describe("toProjectPath", () => {
    it("yolları / ile başlatır ve Windows ayraçlarını düzeltir", () => {
        expect(toProjectPath("a/b.css")).toBe("/a/b.css");
        expect(toProjectPath("./a.html")).toBe("/a.html");
        expect(toProjectPath("klasor\\a.js")).toBe("/klasor/a.js");
    });
});

describe("resolveProject (R-12)", () => {
    it("kökteki index.html ile başlar", () => {
        const project = resolveProject([
            file("/index.html"),
            file("/css/a.css"),
        ]);
        expect(project.entry).toBe("/index.html");
        expect(paths(project)).toEqual(["/css/a.css", "/index.html"]);
    });

    it("index.html tek bir klasördeyse o klasörü kök yapar", () => {
        const project = resolveProject([
            file("/portfolyo/index.html"),
            file("/portfolyo/css/a.css"),
            file("/README.md"),
        ]);
        expect(project.entry).toBe("/index.html");
        expect(paths(project)).toEqual(["/css/a.css", "/index.html"]);
    });

    it("index.html birden fazla klasördeyse kullanıcıya sorar", () => {
        const project = resolveProject([
            file("/a/index.html"),
            file("/b/index.html"),
            file("/b/hakkinda.html"),
        ]);
        expect(project.entry).toBeNull();
        expect(project.choices).toEqual([
            "/a/index.html",
            "/b/hakkinda.html",
            "/b/index.html",
        ]);
    });

    it("index.html yoksa HTML dosyalarını seçenek olarak sunar", () => {
        const project = resolveProject([file("/ana.html"), file("/x.css")]);
        expect(project.choices).toEqual(["/ana.html"]);
    });

    it("hiç HTML yoksa hata verir", () => {
        expect(() => resolveProject([file("/a.css")])).toThrow("noHtml");
    });

    it("işletim sistemi artığı dosyaları yok sayar", () => {
        const project = resolveProject([
            file("/index.html"),
            file("/__MACOSX/._index.html"),
            file("/.DS_Store"),
            file("/img/Thumbs.db"),
        ]);
        expect(paths(project)).toEqual(["/index.html"]);
    });
});
