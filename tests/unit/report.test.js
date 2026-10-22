import { describe, expect, it } from "vitest";
import {
    buildReport,
    escapeHtml,
    escapeMarkdown,
    toHtml,
    toMarkdown,
} from "../../app/src/report/build.js";

const device = (id, name) => ({
    id,
    name,
    sizeText: "402 × 874",
    dprText: "3×",
    orientationText: "Dikey",
});

const info = {
    language: "tr",
    title: "Test raporu",
    rows: [
        ["Adres", "https://example.com/?a=1&b=2"],
        ["Tarih", "22 Ekim 2026 22:15"],
    ],
    footer: "ResponsiveController ile oluşturuldu.",
    labels: {
        devices: "Test edilen cihazlar",
        device: "Cihaz",
        size: "Boyut",
        dpr: "Piksel yoğunluğu",
        orientation: "Konum",
        details: "Cihaz ayrıntıları",
        generalNote: "Genel not",
        generalShots: "Genel görüntüler",
    },
};

const sample = () =>
    buildReport({
        devices: [device("a", "iPhone 17"), device("b", "Pixel 10")],
        notes: {
            session: "  Genel sorun  ",
            devices: { a: "Menü <taşıyor>\nikinci satır", c: "eski" },
        },
        shots: [
            { id: "s1", deviceId: "a", alt: "iPhone 17 görüntüsü" },
            { id: "s2", deviceId: null, alt: "Genel görüntüler" },
        ],
    });

describe("buildReport", () => {
    it("tüm cihazları tabloda, yalnızca notu / görüntüsü olanları ayrıntıda tutar", () => {
        const model = sample();
        expect(model.devices.map((item) => item.id)).toEqual(["a", "b"]);
        expect(model.details.map((item) => item.device.id)).toEqual(["a"]);
        expect(model.details[0].shots.map((shot) => shot.id)).toEqual(["s1"]);
        expect(model.general.note).toBe("Genel sorun");
        expect(model.general.shots.map((shot) => shot.id)).toEqual(["s2"]);
    });

    it("not ve görüntü yoksa genel bölüm ve ayrıntı boştur", () => {
        const model = buildReport({
            devices: [device("a", "iPhone 17")],
            notes: { session: " ", devices: { a: "  " } },
            shots: [],
        });
        expect(model.details).toEqual([]);
        expect(model.general).toEqual({ note: "", shots: [] });
    });
});

describe("kaçırma", () => {
    it("HTML özel karakterleri", () => {
        expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
            "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
        );
    });

    it("Markdown özel karakterleri", () => {
        expect(escapeMarkdown("# *a* [b](c) | x.y")).toBe(
            "\\# \\*a\\* \\[b\\](c) \\| x.y",
        );
        expect(escapeMarkdown("- madde\n1. sıra\n2026-10")).toBe(
            "\\- madde\n1\\. sıra\n2026-10",
        );
    });
});

describe("toHtml", () => {
    it("bölümleri, kaçırılmış notları ve görselleri içerir", () => {
        const html = toHtml(sample(), info, (shot) => `data:${shot.id}`);
        expect(html).toContain('<html lang="tr">');
        expect(html).toContain("<h1>Test raporu</h1>");
        expect(html).toContain("https://example.com/?a=1&amp;b=2");
        expect(html).toContain("<td>Pixel 10</td>");
        expect(html).toContain("Menü &lt;taşıyor&gt;<br>ikinci satır");
        expect(html).toContain('<img src="data:s1" alt="iPhone 17 görüntüsü">');
        expect(html).toContain("<h3>Genel görüntüler</h3>");
        expect(html).toContain("<h2>Cihaz ayrıntıları</h2>");
        expect(html).not.toContain("<script");
    });

    it("ayrıntı yoksa ayrıntı başlığı çıkmaz", () => {
        const model = buildReport({
            devices: [device("a", "iPhone 17")],
            notes: { session: "", devices: {} },
            shots: [],
        });
        const html = toHtml(model, info, () => "");
        expect(html).not.toContain("Cihaz ayrıntıları");
        expect(html).not.toContain("Genel not");
    });
});

describe("toMarkdown", () => {
    it("tablo, notlar ve görsel yolları", () => {
        const markdown = toMarkdown(
            sample(),
            info,
            (shot) => `gorseller/${shot.id} ş.png`,
        );
        expect(markdown.startsWith("# Test raporu\n")).toBe(true);
        expect(markdown).toContain(
            "| Cihaz | Boyut | Piksel yoğunluğu | Konum |",
        );
        expect(markdown).toContain("| iPhone 17 | 402 × 874 | 3× | Dikey |");
        expect(markdown).toContain("Menü \\<taşıyor\\>  \nikinci satır");
        expect(markdown).toContain(
            "![iPhone 17 görüntüsü](gorseller/s1%20%C5%9F.png)",
        );
        expect(markdown).toContain("### Genel görüntüler");
        expect(markdown).toContain("ResponsiveController ile oluşturuldu.");
    });
});
