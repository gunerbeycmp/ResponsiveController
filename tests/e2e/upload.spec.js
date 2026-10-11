import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = "http://localhost:5173/";
test.use({ locale: "tr-TR" });

const zipBuffer = (files) =>
    Buffer.from(
        zipSync(
            Object.fromEntries(
                Object.entries(files).map(([name, text]) => [
                    name,
                    strToU8(text),
                ]),
            ),
        ),
    );

async function openDialog(page) {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Yükle" }).click();
    await expect(
        page.getByRole("dialog", { name: "Projeni yükle" }),
    ).toBeVisible();
}

const preview = (page) => page.frameLocator("#preview-iframe");

test("pencere açılır, Esc ile kapanır, odak Yükle düğmesine döner", async ({
    page,
}) => {
    await openDialog(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#upload-dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Yükle" })).toBeFocused();
});

test("pencere açıkken WCAG 2.1 AA ihlali yok", async ({ page }) => {
    await openDialog(page);
    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
    expect(results.violations).toEqual([]);
});

test("tek HTML dosyası yüklenip önizlenir (FR-1.3)", async ({ page }) => {
    await openDialog(page);
    await page.locator("#file-input").setInputFiles({
        name: "tek.html",
        mimeType: "text/html",
        buffer: Buffer.from(
            "<!doctype html><title>Tek</title><h1>Tek sayfa</h1>",
        ),
    });
    await expect(page.locator("#upload-dialog")).not.toBeVisible();
    await expect(preview(page).locator("h1")).toHaveText("Tek sayfa");
});

test("ZIP yüklenir, tek klasör kök yapılır, CSS çalışır (FR-1.1, R-12)", async ({
    page,
}) => {
    await openDialog(page);
    await page.locator("#file-input").setInputFiles({
        name: "portfolyo.zip",
        mimeType: "application/zip",
        buffer: zipBuffer({
            "portfolyo/index.html":
                '<!doctype html><link rel="stylesheet" href="/css/stil.css"><h1>Portfolyo</h1>',
            "portfolyo/css/stil.css": "h1 { color: rgb(0, 128, 0); }",
            "__MACOSX/portfolyo/._index.html": "artık",
        }),
    });
    await expect(preview(page).locator("h1")).toHaveText("Portfolyo");
    await expect(preview(page).locator("h1")).toHaveCSS(
        "color",
        "rgb(0, 128, 0)",
    );
});

test("klasör yüklenir (FR-1.2)", async ({ page }) => {
    const root = mkdtempSync(join(tmpdir(), "rc-klasor-"));
    const folder = join(root, "sitem");
    mkdirSync(join(folder, "img"), { recursive: true });
    writeFileSync(join(folder, "index.html"), "<!doctype html><h1>Klasör</h1>");
    writeFileSync(
        join(folder, "img", "a.svg"),
        "<svg xmlns='http://www.w3.org/2000/svg'/>",
    );

    await openDialog(page);
    await page.locator("#folder-input").setInputFiles(folder);
    await expect(preview(page).locator("h1")).toHaveText("Klasör");
});

test("birden fazla index.html varsa sayfa seçtirilir (R-12)", async ({
    page,
}) => {
    await openDialog(page);
    await page.locator("#file-input").setInputFiles({
        name: "iki.zip",
        mimeType: "application/zip",
        buffer: zipBuffer({
            "a/index.html": "<h1>A</h1>",
            "b/index.html": "<h1>B</h1>",
        }),
    });
    await expect(
        page.getByRole("heading", { name: "Hangi sayfayla başlansın?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "/b/index.html" }).click();
    await expect(preview(page).locator("h1")).toHaveText("B");
});

for (const [title, uploadFile, message] of [
    [
        "desteklenmeyen dosya türü",
        { name: "not.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
        "Yalnızca .zip ve .html dosyaları yüklenebilir.",
    ],
    [
        "bozuk ZIP",
        {
            name: "bozuk.zip",
            mimeType: "application/zip",
            buffer: Buffer.from("bu bir zip değil"),
        },
        "ZIP dosyası açılamadı.",
    ],
    [
        "HTML içermeyen proje",
        {
            name: "stil.zip",
            mimeType: "application/zip",
            buffer: zipBuffer({ "stil.css": "body{}" }),
        },
        "açılacak bir HTML dosyası bulunamadı",
    ],
    [
        "50 MB'ı aşan dosya (FR-1.6)",
        {
            name: "buyuk.html",
            mimeType: "text/html",
            buffer: Buffer.alloc(50 * 1024 * 1024 + 1, 32),
        },
        "Proje 50 MB sınırını aşıyor.",
    ],
]) {
    test(`hata: ${title}`, async ({ page }) => {
        let upload = uploadFile;
        await openDialog(page);
        // Playwright 50 MB'tan büyük veriyi ancak dosya yolu olarak verebilir
        if (upload.buffer.length > 50 * 1024 * 1024) {
            const path = join(
                mkdtempSync(join(tmpdir(), "rc-buyuk-")),
                upload.name,
            );
            writeFileSync(path, upload.buffer);
            upload = path;
        }
        await page.locator("#file-input").setInputFiles(upload);
        await expect(page.locator("#upload-status")).toContainText(message);
        await expect(page.locator("#upload-status")).toHaveAttribute(
            "data-error",
            "true",
        );
        await expect(page.locator("#upload-dialog")).toBeVisible();
    });
}

test("dosya sürükleyip bırakılarak yüklenir", async ({ page }) => {
    await openDialog(page);
    await page.evaluate(() => {
        const transfer = new DataTransfer();
        transfer.items.add(
            new File(["<!doctype html><h1>Bırakıldı</h1>"], "birak.html", {
                type: "text/html",
            }),
        );
        const zone = document.getElementById("dropzone");
        zone.dispatchEvent(
            new DragEvent("dragover", {
                dataTransfer: transfer,
                bubbles: true,
            }),
        );
        zone.dispatchEvent(
            new DragEvent("drop", { dataTransfer: transfer, bubbles: true }),
        );
    });
    await expect(preview(page).locator("h1")).toHaveText("Bırakıldı");
});

test.describe("dar ekran", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("Yükle düğmesi URL satırında, Aç düğmesinin yanında", async ({
        page,
    }) => {
        await page.goto(APP_URL);
        const upload = page.getByRole("button", { name: "Yükle" });
        await expect(upload).toBeVisible();
        await expect(upload).toContainText("Yükle");
        const button = await upload.boundingBox();
        const open = await page
            .getByRole("button", { name: "Aç" })
            .boundingBox();
        const input = await page.locator("#url-input").boundingBox();
        const logo = await page.locator(".logo").boundingBox();
        const middle = (box) => box.y + box.height / 2;
        // URL alanı, Aç ve Yükle aynı satırda; logo üst satırda
        expect(Math.abs(middle(button) - middle(open))).toBeLessThan(4);
        expect(Math.abs(middle(input) - middle(open))).toBeLessThan(4);
        expect(button.x).toBeGreaterThan(open.x);
        expect(middle(logo)).toBeLessThan(input.y);
        const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
        );
        expect(scrollWidth).toBe(375);
    });
});
