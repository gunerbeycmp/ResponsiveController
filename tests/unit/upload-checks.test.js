import { describe, expect, it } from "vitest";
import {
    findMissingFiles,
    findReferences,
    findServerFiles,
    hasViewportMeta,
    isSourceProject,
    projectWarnings,
    resolveReference,
} from "../../app/src/upload/checks.js";

const encode = (text) => new TextEncoder().encode(text).buffer;

describe("isSourceProject (FR-1.9)", () => {
    it("package.json ve src/ varsa kaynak kod sayar", () => {
        expect(
            isSourceProject(["/index.html", "/package.json", "/src/main.js"]),
        ).toBe(true);
    });

    it("derlenmiş projeyi kaynak kod saymaz", () => {
        expect(isSourceProject(["/index.html", "/assets/app.js"])).toBe(false);
        expect(isSourceProject(["/package.json", "/index.html"])).toBe(false);
    });
});

describe("hasViewportMeta (FR-1.7)", () => {
    it("farklı yazımlarla viewport etiketini bulur", () => {
        expect(
            hasViewportMeta(
                '<meta name="viewport" content="width=device-width">',
            ),
        ).toBe(true);
        expect(
            hasViewportMeta(
                "<META content='width=device-width' NAME='viewport'>",
            ),
        ).toBe(true);
        expect(hasViewportMeta("<meta name=viewport content=x>")).toBe(true);
    });

    it("viewport etiketi yoksa false döner", () => {
        expect(
            hasViewportMeta('<meta name="description" content="viewport">'),
        ).toBe(false);
        expect(hasViewportMeta("<h1>a</h1>")).toBe(false);
    });
});

describe("findServerFiles (FR-1.8)", () => {
    it("sunucu dosyalarını bulur", () => {
        expect(
            findServerFiles(["/index.php", "/a.html", "/api/x.py", "/b.aspx"]),
        ).toEqual(["/api/x.py", "/b.aspx", "/index.php"]);
    });
});

describe("findReferences ve resolveReference", () => {
    it("CSS, JS, görsel ve ikon adreslerini bulur, yorumları atlar", () => {
        const html = `
            <link rel="stylesheet" href="css/a.css">
            <link rel="canonical" href="https://x.com">
            <link rel="icon" href='/fav.ico'>
            <script src="js/app.js"></script>
            <img src=logo.png alt="">
            <!-- <img src="yorum.png"> -->`;
        expect(findReferences(html)).toEqual([
            "js/app.js",
            "logo.png",
            "css/a.css",
            "/fav.ico",
        ]);
    });

    it("göreli adresi başlangıç sayfasına göre çözer, harici adresleri atlar", () => {
        expect(resolveReference("css/a.css", "/index.html")).toBe("/css/a.css");
        expect(resolveReference("../img/b.png", "/blog/yazi.html")).toBe(
            "/img/b.png",
        );
        expect(resolveReference("a.css?v=2#x", "/index.html")).toBe("/a.css");
        expect(resolveReference("g%C3%B6rsel.png", "/index.html")).toBe(
            "/görsel.png",
        );
        for (const external of [
            "https://cdn.com/a.js",
            "//cdn.com/a.js",
            "data:image/png;base64,x",
            "#bolum",
        ]) {
            expect(resolveReference(external, "/index.html")).toBeNull();
        }
    });
});

describe("findMissingFiles (FR-1.10)", () => {
    it("projede olmayan dosyaları listeler", () => {
        const html =
            '<link rel="stylesheet" href="style.css"><img src="img/logo.png"><script src="https://cdn.com/x.js"></script>';
        expect(
            findMissingFiles(html, "/index.html", [
                "/index.html",
                "/style.css",
            ]),
        ).toEqual(["/img/logo.png"]);
    });
});

describe("projectWarnings", () => {
    it("sorunsuz projede uyarı vermez", () => {
        const files = [
            {
                path: "/index.html",
                data: encode(
                    '<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="a.css">',
                ),
            },
            { path: "/a.css", data: encode("") },
        ];
        expect(projectWarnings({ files, entry: "/index.html" })).toEqual([]);
    });

    it("üç uyarıyı birlikte verir, uzun listeleri kısaltır", () => {
        const files = [
            {
                path: "/index.html",
                data: encode('<link rel="stylesheet" href="yok.css">'),
            },
            ...["a", "b", "c", "d", "e", "f"].map((name) => ({
                path: `/${name}.php`,
                data: encode(""),
            })),
        ];
        expect(projectWarnings({ files, entry: "/index.html" })).toEqual([
            { key: "warnings.viewport" },
            {
                key: "warnings.serverFiles",
                params: {
                    files: "/a.php, /b.php, /c.php, /d.php, /e.php (+1)",
                },
            },
            { key: "warnings.missingFiles", params: { files: "/yok.css" } },
        ]);
    });
});
