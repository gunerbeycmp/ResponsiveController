import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

// Üç renkli, kaydırılabilir sayfa: kırmızı (0-500), yeşil (500-1000), mavi
const PROJECT = Buffer.from(
    zipSync({
        "index.html": strToU8(
            '<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>body{margin:0}div{height:500px}</style></head><body><div style="background:#ff0000"></div><div style="background:#00ff00"></div><div style="background:#0000ff"></div></body></html>',
        ),
    }),
);

async function uploadProject(page) {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Yükle" }).click();
    await page.locator("#file-input").setInputFiles({
        name: "renk.zip",
        mimeType: "application/zip",
        buffer: PROJECT,
    });
    await expect(page.locator("#upload-dialog")).not.toBeVisible();
}

const shotButton = (page) =>
    page.getByRole("button", { name: "iPhone 17 ekran görüntüsünü al" });

// Görselin boyutu ve iki noktasının rengi
const inspect = (page) =>
    page.locator("#shot-image").evaluate(async (img) => {
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0);
        const pixel = (x, y) =>
            Array.from(context.getImageData(x, y, 1, 1).data)
                .slice(0, 3)
                .join(",");
        return {
            width: img.naturalWidth,
            height: img.naturalHeight,
            top: pixel(10, 10),
            lower: pixel(10, 450 * 3),
        };
    });

test("URL ile açılan sitede ekran görüntüsü düğmesi görünmez (v0.4.5'e kadar)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
    await expect(page.locator("#frame-shot")).toBeHidden();
});

test("yüklenen projede görünen alanın ekran görüntüsü alınır (FR-4.1)", async ({
    page,
}) => {
    await uploadProject(page);
    // Önizlemede sayfa kaydırılır: görünen alan yeşil ve mavi bölümdür
    await page
        .frameLocator("#preview-iframe")
        .locator("body")
        .evaluate(() => window.scrollTo(0, 600));
    await shotButton(page).click();
    const dialog = page.getByRole("dialog", { name: "Ekran görüntüsü" });
    await expect(dialog).toBeVisible();
    const image = page.getByRole("img", {
        name: "iPhone 17 ekran görüntüsü (402 × 874)",
    });
    await expect(image).toBeVisible();
    // Gerçek piksel yoğunluğu (DPR 3)
    expect(await inspect(page)).toEqual({
        width: 1206,
        height: 2622,
        top: "0,255,0",
        lower: "0,0,255",
    });
    await expect(page.getByRole("button", { name: "İndir" })).toBeFocused();

    // İndir: dosya adı cihaz, boyut, tarih ve saat
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    expect((await download).suggestedFilename()).toMatch(
        /^iphone-17-402x874-\d{4}-\d{2}-\d{2}-\d{4}\.png$/,
    );

    // Kapatınca odak 📷 düğmesine döner
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(shotButton(page)).toBeFocused();
});

test("Kopyala panoya görsel kopyalar ya da açıklama gösterir", async ({
    page,
    context,
    browserName,
}) => {
    if (browserName === "chromium")
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await uploadProject(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await page.getByRole("button", { name: "Kopyala" }).click();
    const message = page.locator("#shot-message");
    if (browserName === "chromium") {
        await expect(message).toHaveText("Panoya kopyalandı.");
        const types = await page.evaluate(async () =>
            (await navigator.clipboard.read()).flatMap((item) => item.types),
        );
        expect(types).toContain("image/png");
    } else {
        await expect(message).toHaveText(
            /^(Panoya kopyalandı\.|Kopyalanamadı\. .+)$/,
        );
    }
});

test("ekran görüntüsü alınamazsa hata gösterilir", async ({ page }) => {
    // Cevap gelmezse 15 saniye sonra zaman aşımı
    test.setTimeout(40000);
    await uploadProject(page);
    // Önizleme yardımcı betiği olmayan bir sayfaya gider: cevap gelmez
    await page
        .locator("#preview-iframe")
        .evaluate(
            (frame) => (frame.src = "http://localhost:5174/__rc/bridge.html"),
        );
    await page.waitForTimeout(500);
    await shotButton(page).click();
    await expect(page.locator("#shot-status")).toHaveText(
        "Ekran görüntüsü alınıyor…",
    );
    await expect(page.locator("#shot-status")).toHaveText(
        "Ekran görüntüsü alınamadı. Tekrar dene.",
        { timeout: 20000 },
    );
    await expect(page.locator("#shot-actions")).toBeHidden();
});

test("ekran görüntüsü penceresinde WCAG 2.1 AA ihlali yok", async ({
    page,
}) => {
    await uploadProject(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
