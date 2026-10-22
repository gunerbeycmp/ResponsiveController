import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

const PROJECT = Buffer.from(
    zipSync({
        "index.html": strToU8(
            '<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#fff}</style><p>Kafe</p>',
        ),
    }),
);

// Kafe projesi; iPhone 17 notu ve rapora eklenmiş bir görüntü
async function prepare(page) {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Yükle" }).click();
    await page.locator("#file-input").setInputFiles({
        name: "kafe.zip",
        mimeType: "application/zip",
        buffer: PROJECT,
    });
    await expect(page.locator("#upload-dialog")).not.toBeVisible();
    await page
        .getByRole("button", { name: "iPhone 17 ekran görüntüsünü al" })
        .click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await page.getByRole("button", { name: "Rapora ekle" }).click();
    await expect(page.locator("#shot-message")).toHaveText("Rapora eklendi.");
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
    await page.getByRole("button", { name: "Notlar", exact: true }).click();
    await page.getByLabel("Genel not").fill("Genel *iyi* <b>");
    await page
        .locator("#notes-panel")
        .getByRole("textbox", { name: "iPhone 17 notu" })
        .fill("Menü taşıyor");
}

const preview = (page) => page.frameLocator("#report-preview");

test("rapor önizlenir ve HTML olarak görseller gömülü iner (FR-5.1, FR-5.2)", async ({
    page,
}) => {
    await prepare(page);
    const create = page.getByRole("button", { name: "Rapor oluştur" });
    await create.click();
    const dialog = page.getByRole("dialog", { name: "Test raporu" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "İndir" })).toBeFocused();
    await page.getByRole("button", { name: "HTML", exact: true }).click();
    await expect(
        page.getByRole("button", { name: "HTML", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Kalite yalnızca PDF'te
    await expect(
        page.getByRole("group", { name: "PDF görsel kalitesi" }),
    ).toBeHidden();

    await expect(page.locator("#report-preview")).toHaveAccessibleName(
        "Rapor önizlemesi",
    );
    const doc = preview(page);
    await expect(doc.getByRole("heading", { level: 1 })).toHaveText(
        "Test raporu",
    );
    await expect(doc.getByText("Proje:")).toBeVisible();
    await expect(doc.locator("tbody tr").first()).toContainText("iPhone 17");
    await expect(doc.locator("tbody tr").first()).toContainText("402 × 874");
    await expect(doc.locator("tbody tr").first()).toContainText("3×");
    await expect(doc.locator("tbody tr").first()).toContainText("Dikey");
    await expect(doc.getByText("Genel *iyi* <b>")).toBeVisible();
    await expect(
        doc.getByRole("heading", { name: "Cihaz ayrıntıları" }),
    ).toBeVisible();
    await expect(doc.getByText("Menü taşıyor")).toBeVisible();
    await expect(
        doc.getByRole("img", {
            name: "iPhone 17 ekran görüntüsü (1206 × 2622)",
        }),
    ).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
        /^rapor-\d{4}-\d{2}-\d{2}-\d{4}\.html$/,
    );
    const html = readFileSync(await file.path(), "utf8");
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain("Genel *iyi* &lt;b&gt;");
    expect(html).toMatch(/<img src="data:image\/png;base64,/);
    expect(html).toContain("ResponsiveController ile oluşturuldu.");

    // Esc kapatır, odak düğmeye döner
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(create).toBeFocused();
});

test("Markdown rapor ve görseller ZIP olarak iner (FR-5.2)", async ({
    page,
}) => {
    await prepare(page);
    await page.getByRole("button", { name: "Rapor oluştur" }).click();
    const markdown = page.getByRole("button", { name: "Markdown" });
    await markdown.click();
    await expect(markdown).toHaveAttribute("aria-pressed", "true");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
        /^rapor-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/,
    );
    const files = unzipSync(readFileSync(await file.path()));
    const names = Object.keys(files).sort();
    expect(names).toEqual(["gorseller/iphone-17-1206x2622.png", "rapor.md"]);
    const text = strFromU8(files["rapor.md"]);
    expect(text).toContain("# Test raporu");
    expect(text).toContain("**Proje:** kafe");
    expect(text).toContain("| iPhone 17 | 402 × 874 | 3× | Dikey |");
    expect(text).toContain("Genel \\*iyi\\* \\<b\\>");
    expect(text).toContain(
        "![iPhone 17 ekran görüntüsü (1206 × 2622)](gorseller/iphone-17-1206x2622.png)",
    );
    // PNG imzası
    expect([...files["gorseller/iphone-17-1206x2622.png"].slice(0, 4)]).toEqual(
        [0x89, 0x50, 0x4e, 0x47],
    );
});

test("rapor İngilizce arayüzde İngilizce oluşur (FR-5.2, FR-1.4)", async ({
    page,
}) => {
    await prepare(page);
    await page.getByRole("button", { name: "Notları kapat" }).click();
    await page.getByRole("button", { name: "EN" }).click();
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    await page.getByRole("button", { name: "Create report" }).click();
    const doc = preview(page);
    await expect(doc.getByRole("heading", { level: 1 })).toHaveText(
        "Test report",
    );
    await expect(doc.locator("thead")).toContainText("Pixel density");
    await expect(doc.locator("tbody tr").first()).toContainText("Portrait");
    await page.getByRole("button", { name: "Markdown" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^report-.*\.zip$/);
    const names = Object.keys(unzipSync(readFileSync(await file.path())));
    expect(names).toContain("report.md");
    expect(names.some((name) => name.startsWith("images/"))).toBe(true);
});

test("rapor penceresi ve rapor dosyası erişilebilirlik denetiminden geçer (NFR-5.1)", async ({
    page,
    context,
}) => {
    await prepare(page);
    await page.getByRole("button", { name: "Rapor oluştur" }).click();
    await expect(
        preview(page).getByRole("heading", { level: 1 }),
    ).toBeVisible();
    // Önizleme betiksiz bir çerçevedir; axe içine giremez, rapor dosyası
    // ayrıca denetlenir
    const results = await new AxeBuilder({ page })
        .include("#report-dialog")
        .exclude("#report-preview")
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole("button", { name: "HTML", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const html = readFileSync(await (await download).path(), "utf8");
    const report = await context.newPage();
    await report.setContent(html);
    const fileResults = await new AxeBuilder({ page: report })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(fileResults.violations).toEqual([]);
});

test("PDF varsayılandır; görsel kalitesi seçilir ve hatırlanır (FR-5.2, R-17, R-41)", async ({
    page,
}) => {
    await prepare(page);
    await page.getByRole("button", { name: "Rapor oluştur" }).click();
    await expect(
        page.getByRole("button", { name: "PDF", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const quality = page.getByRole("group", { name: "PDF görsel kalitesi" });
    await expect(quality).toBeVisible();
    const small = quality.getByRole("button", { name: "Küçük dosya" });
    const high = quality.getByRole("button", { name: "Yüksek kalite" });
    await expect(small).toHaveAttribute("aria-pressed", "true");

    const pdfOf = async () => {
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "İndir" }).click();
        const file = await download;
        expect(file.suggestedFilename()).toMatch(
            /^rapor-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/,
        );
        return readFileSync(await file.path());
    };
    const smallPdf = await pdfOf();
    expect(smallPdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = smallPdf.toString("latin1");
    // Inter gömülü; küçük dosyada görsel JPEG
    expect(text).toContain("Inter");
    expect(text).toContain("/DCTDecode");
    expect(text).toMatch(/\/Type \/Page\b/);

    await high.click();
    await expect(high).toHaveAttribute("aria-pressed", "true");
    const highPdf = (await pdfOf()).toString("latin1");
    expect(highPdf).not.toContain("/DCTDecode");
    expect(highPdf).toContain("/FlateDecode");

    // Seçim hatırlanır
    await page.keyboard.press("Escape");
    await page.reload();
    expect(
        await page.evaluate(() => localStorage.getItem("rc-report-quality")),
    ).toBe("high");
});
