import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { strToU8, unzipSync, zipSync } from "fflate";

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

// 6000 px uzunluğunda sayfa: iPhone 17'nin DPR 3 değeriyle sınırı aşar
const LONG = Buffer.from(
    zipSync({
        "index.html": strToU8(
            '<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>body{margin:0}div{height:3000px}</style></head><body><div style="background:#ff0000"></div><div style="background:#0000ff"></div></body></html>',
        ),
    }),
);

async function uploadProject(page, buffer = PROJECT) {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Yükle" }).click();
    await page.locator("#file-input").setInputFiles({
        name: "renk.zip",
        mimeType: "application/zip",
        buffer,
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

test("tam sayfa görüntü alınır (FR-4.1)", async ({ page }) => {
    await uploadProject(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    const full = page.getByRole("button", { name: "Tam sayfa" });
    await full.click();
    await expect(full).toHaveAttribute("aria-pressed", "true");
    await expect(
        page.getByRole("img", {
            name: "iPhone 17 ekran görüntüsü (402 × 1500)",
        }),
    ).toBeVisible();
    // 1500 px sayfa sınıra sığar: tam yoğunluk, not yok
    const size = await page.locator("#shot-image").evaluate(async (img) => {
        await img.decode();
        return [img.naturalWidth, img.naturalHeight];
    });
    expect(size).toEqual([1206, 4500]);
    await expect(page.locator("#shot-note")).toBeHidden();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    expect((await download).suggestedFilename()).toMatch(
        /^iphone-17-402x874-tam-sayfa-\d{4}-\d{2}-\d{2}-\d{4}\.png$/,
    );
    // Görünen alana dönülür
    await page.getByRole("button", { name: "Görünen alan" }).click();
    await expect(
        page.getByRole("img", {
            name: "iPhone 17 ekran görüntüsü (402 × 874)",
        }),
    ).toBeVisible();
});

test("çok uzun sayfada yoğunluk düşer, parçalara bölünür (R-64)", async ({
    page,
}) => {
    test.setTimeout(60000);
    await uploadProject(page, LONG);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await page.getByRole("button", { name: "Tam sayfa" }).click();
    await expect(page.locator("#shot-note-text")).toHaveText(
        /Sayfa çok uzun olduğu için görüntü 2,7x yoğunlukta alındı\./,
    );
    const size = await page.locator("#shot-image").evaluate(async (img) => {
        await img.decode();
        return [img.naturalWidth, img.naturalHeight];
    });
    expect(size[1]).toBeLessThanOrEqual(16384);
    expect(size[1]).toBeGreaterThan(16000);

    await page.getByRole("button", { name: "Parçalara böl" }).click();
    await expect(page.locator("#shot-note-text")).toHaveText(
        "Sayfa 2 parçaya bölündü. İndir, parçaları tek bir ZIP dosyası olarak indirir; Kopyala yalnızca tek görselde kullanılabilir.",
    );
    await expect(
        page.getByRole("img", { name: "iPhone 17 tam sayfa, parça 2 / 2" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Kopyala" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "İndir" })).toBeFocused();
    // Parçalar tam yoğunlukta (DPR 3)
    const heights = await page
        .locator("#shot-parts img")
        .evaluateAll((images) =>
            Promise.all(
                images.map(async (img) => {
                    await img.decode();
                    return [img.naturalWidth, img.naturalHeight];
                }),
            ),
        );
    expect(heights).toEqual([
        [1206, 16383],
        [1206, 1617],
    ]);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
        /^iphone-17-402x874-tam-sayfa-.+\.zip$/,
    );
    const entries = Object.keys(unzipSync(readFileSync(await file.path())));
    expect(entries).toEqual(["parca-01.png", "parca-02.png"]);
});

// İndirilen dosyanın adı ve ilk baytları
async function downloadFile(page) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const file = await download;
    const bytes = readFileSync(await file.path());
    return { name: file.suggestedFilename(), bytes };
}

test("arka plan rengi verilmemiş sayfa beyaz zeminde alınır", async ({
    page,
}) => {
    await uploadProject(
        page,
        Buffer.from(
            zipSync({
                "index.html": strToU8(
                    '<!doctype html><meta name="viewport" content="width=device-width"><p>Metin</p>',
                ),
            }),
        ),
    );
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    const corner = await page.locator("#shot-image").evaluate(async (img) => {
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(img, 0, 0);
        return Array.from(
            context.getImageData(
                img.naturalWidth - 5,
                img.naturalHeight - 5,
                1,
                1,
            ).data,
        );
    });
    expect(corner).toEqual([255, 255, 255, 255]);
});

test("dosya biçimi seçilir ve hatırlanır (FR-4.5)", async ({ page }) => {
    await uploadProject(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    const png = page.getByRole("button", { name: "PNG", exact: true });
    const jpeg = page.getByRole("button", { name: "JPEG", exact: true });
    const webp = page.getByRole("button", { name: "WebP", exact: true });
    // İlk kullanımda PNG
    await expect(png).toHaveAttribute("aria-pressed", "true");

    await jpeg.click();
    await expect(jpeg).toHaveAttribute("aria-pressed", "true");
    const jpg = await downloadFile(page);
    expect(jpg.name).toMatch(/^iphone-17-402x874-.+\.jpg$/);
    // JPEG imzası FF D8 FF
    expect([...jpg.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);

    await webp.click();
    const webpFile = await downloadFile(page);
    expect(webpFile.name).toMatch(/\.webp$/);
    expect(webpFile.bytes.subarray(8, 12).toString()).toBe("WEBP");

    // Pencere kapatılıp açılınca son seçim hatırlanır
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
    await page.reload();
    await uploadProject(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await expect(webp).toHaveAttribute("aria-pressed", "true");
});

test("WebP oluşturamayan tarayıcıda PNG indirilir ve açıklanır", async ({
    page,
}) => {
    // WebP desteklemeyen tarayıcı gibi davran: toBlob her zaman PNG verir
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback, type, q) {
            return original.call(
                this,
                callback,
                type === "image/webp" ? "image/png" : type,
                q,
            );
        };
    });
    await uploadProject(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await page.getByRole("button", { name: "WebP", exact: true }).click();
    const file = await downloadFile(page);
    expect(file.name).toMatch(/\.png$/);
    await expect(page.locator("#shot-message")).toHaveText(
        "Bu tarayıcı WebP dosyası oluşturamıyor; görüntü PNG olarak indirildi.",
    );
});

test("parçalar seçilen biçimde ZIP'e girer", async ({ page }) => {
    test.setTimeout(60000);
    await uploadProject(page, LONG);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await page.getByRole("button", { name: "Tam sayfa" }).click();
    await page.getByRole("button", { name: "Parçalara böl" }).click();
    await expect(page.locator("#shot-parts img")).toHaveCount(2);
    await page.getByRole("button", { name: "JPEG", exact: true }).click();
    const file = await downloadFile(page);
    expect(file.name).toMatch(/\.zip$/);
    expect(Object.keys(unzipSync(file.bytes))).toEqual([
        "parca-01.jpg",
        "parca-02.jpg",
    ]);
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
