import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const expectFrameSize = async (page, text) => {
    const [width, height] = text.split(" × ");
    await expect(page.locator("#frame-width")).toHaveValue(width);
    await expect(page.locator("#frame-height")).toHaveValue(height);
};

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

const box = (page, id) =>
    page.locator(`#device-grid > li[data-grid-id="${id}"]`);
const status = (page) => page.locator("#app-status");
const scaleValue = (page) => page.locator("#scale-value");

async function openPreview(page) {
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

async function withGrid(page, ids, extra = {}) {
    await page.goto(APP_URL);
    await page.evaluate(
        (value) => localStorage.setItem("rc-grid", value),
        JSON.stringify({ ids, mode: "grid", size: "medium", ...extra }),
    );
    await page.reload();
    await openPreview(page);
}

test("tek cihaz döndürülür; yatayda tarayıcı çubukları seçeneği gizlenir (FR-3.6, R-62)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    await expectFrameSize(page, "402 × 874");
    await expect(page.locator("#browser-bars-option")).toBeVisible();
    const rotate = page.getByRole("button", {
        name: "iPhone 17 cihazını yataya çevir",
    });
    await rotate.click();
    await expectFrameSize(page, "874 × 402");
    await expect(status(page)).toHaveText("iPhone 17 yatay konuma çevrildi.");
    await expect(page.locator("#browser-bars-option")).toBeHidden();
    const viewport = page.locator("#frame-viewport");
    const { width, height } = await viewport.boundingBox();
    expect(width).toBeGreaterThan(height);

    await page
        .getByRole("button", { name: "iPhone 17 cihazını dikeye çevir" })
        .click();
    await expectFrameSize(page, "402 × 874");
    await expect(page.locator("#browser-bars-option")).toBeVisible();
});

test("döndürme hatırlanır ve ızgarayla ortaktır", async ({ page }) => {
    await page.goto(APP_URL);
    await openPreview(page);
    await page
        .getByRole("button", { name: "iPhone 17 cihazını yataya çevir" })
        .click();
    await page.reload();
    await openPreview(page);
    await expectFrameSize(page, "874 × 402");
    await page
        .locator(".view-toolbar")
        .getByRole("button", { name: "Izgara", exact: true })
        .click();
    await expect(box(page, "iphone-17").locator(".box-size")).toHaveText(
        "874 × 402",
    );
});

test("ızgarada kutu ve toplu döndürme (FR-3.6)", async ({ page }) => {
    await withGrid(page, ["iphone-17", "1920-x-1080", "galaxy-watch"]);
    const rotateAll = page.locator("#rotate-all");
    // Kare ekranlı saat hesaba katılmaz; telefon dikey olduğu için yataya
    await expect(rotateAll).toHaveText("Tümünü yataya çevir");
    await rotateAll.click();
    await expect(box(page, "iphone-17").locator(".box-size")).toHaveText(
        "874 × 402",
    );
    await expect(box(page, "1920-x-1080").locator(".box-size")).toHaveText(
        "1920 × 1080",
    );
    await expect(status(page)).toHaveText(
        "Tüm cihazlar yatay konuma çevrildi.",
    );
    await expect(rotateAll).toHaveText("Tümünü dikeye çevir");
    await rotateAll.click();
    await expect(box(page, "iphone-17").locator(".box-size")).toHaveText(
        "402 × 874",
    );
    await expect(box(page, "1920-x-1080").locator(".box-size")).toHaveText(
        "1080 × 1920",
    );

    // Kutudaki döndür düğmesi yalnızca o kutuyu döndürür
    await box(page, "1920-x-1080")
        .getByRole("button", { name: "1920 × 1080 cihazını yataya çevir" })
        .click();
    await expect(box(page, "1920-x-1080").locator(".box-size")).toHaveText(
        "1920 × 1080",
    );
    await expect(box(page, "iphone-17").locator(".box-size")).toHaveText(
        "402 × 874",
    );
    await expect(rotateAll).toHaveText("Tümünü yataya çevir");

    // Tek cihaz modunda toplu döndürme gösterilmez
    await page
        .locator(".view-toolbar")
        .getByRole("button", { name: "Tek cihaz", exact: true })
        .click();
    await expect(rotateAll).toBeHidden();
});

test("orijinal konuma çevir bütün kutuları varsayılan konuma döndürür", async ({
    page,
}) => {
    await withGrid(page, ["iphone-17", "1920-x-1080"]);
    const reset = page.getByRole("button", { name: "Orijinal konuma çevir" });
    await expect(reset).toBeVisible();
    await expect(reset).toBeDisabled();
    await page.locator("#rotate-all").click();
    await expect(reset).toBeEnabled();
    // Bilgisayar da dikeye çevrilsin: hepsi farklı konumda
    await box(page, "1920-x-1080")
        .getByRole("button", { name: "1920 × 1080 cihazını dikeye çevir" })
        .click();
    await expect(box(page, "iphone-17").locator(".box-size")).toHaveText(
        "874 × 402",
    );
    await reset.click();
    await expect(box(page, "iphone-17").locator(".box-size")).toHaveText(
        "402 × 874",
    );
    await expect(box(page, "1920-x-1080").locator(".box-size")).toHaveText(
        "1920 × 1080",
    );
    await expect(status(page)).toHaveText(
        "Tüm cihazlar orijinal konumuna çevrildi.",
    );
    await expect(reset).toBeDisabled();
    await expect(page.locator("#rotate-all")).toBeFocused();
});

test("kutudaki döndür düğmesi araç çubuğunu da günceller", async ({ page }) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"]);
    const reset = page.getByRole("button", { name: "Orijinal konuma çevir" });
    const rotateAll = page.locator("#rotate-all");
    await expect(reset).toBeDisabled();
    // Yalnızca kutulardaki düğmelerle döndürülür
    await box(page, "iphone-17")
        .getByRole("button", { name: "iPhone 17 cihazını yataya çevir" })
        .click();
    await expect(reset).toBeEnabled();
    await expect(rotateAll).toHaveText("Tümünü yataya çevir");
    await box(page, "galaxy-s24")
        .getByRole("button", { name: "Galaxy S24 cihazını yataya çevir" })
        .click();
    await expect(rotateAll).toHaveText("Tümünü dikeye çevir");
    await reset.click();
    await expect(box(page, "iphone-17").locator(".box-size")).toHaveText(
        "402 × 874",
    );
    await expect(box(page, "galaxy-s24").locator(".box-size")).toHaveText(
        "360 × 780",
    );
    await expect(reset).toBeDisabled();
});

test("genel ölçek tek cihazda çalışır, cihaz çerçevenin içinde kayar (FR-3.9)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    const fit = page.locator("#scale-fit");
    await expect(scaleValue(page)).toBeHidden();
    await expect(page.locator("#scale-slider")).toHaveAttribute(
        "aria-valuetext",
        "Sığdır",
    );
    await expect(fit).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Yakınlaştır" }).click();
    await expect(fit).toHaveAttribute("aria-pressed", "false");
    await page.locator("#scale-slider").fill("150");
    await expect(scaleValue(page)).toHaveText("%150");
    await expect(page.locator("#frame-scale")).toHaveText("%150");
    // Çerçeve alanı aşmaz, içi kayar
    const viewport = page.locator("#frame-viewport");
    const stage = await page.locator("#stage").boundingBox();
    const frame = await viewport.boundingBox();
    expect(frame.y + frame.height).toBeLessThanOrEqual(stage.y + stage.height);
    expect(
        await viewport.evaluate((n) => n.scrollHeight > n.clientHeight),
    ).toBe(true);
    await expect(page.locator("#frame-help")).toBeInViewport();

    // Klavyeyle kaydırıcı
    await page.locator("#scale-slider").focus();
    await page.keyboard.press("ArrowRight");
    await expect(scaleValue(page)).toHaveText("%155");

    await fit.click();
    await expect(scaleValue(page)).toBeHidden();

    // Genel ölçek yeniden yüklemede hatırlanır
    await page.locator("#scale-slider").fill("50");
    await page.reload();
    await openPreview(page);
    await expect(scaleValue(page)).toHaveText("%50");
});

test("genel ölçek kutuların kendi ayarlarını sıfırlar (FR-3.9)", async ({
    page,
}) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"]);
    const iphone = box(page, "iphone-17");
    const galaxy = box(page, "galaxy-s24");
    await iphone.getByRole("button", { name: "Yakınlaştır" }).click();
    await expect(iphone.locator(".box-scale")).toHaveText("%50");
    await page.locator("#scale-slider").fill("100");
    await expect(iphone.locator(".box-scale")).toHaveText("%100");
    await expect(galaxy.locator(".box-scale")).toHaveText("%100");
    // Kutudaki Sığdır yalnızca o kutuyu sığdırır
    await iphone.getByRole("button", { name: "Sığdır" }).click();
    await expect(iphone.locator(".box-scale")).toHaveText("%43");
    await expect(galaxy.locator(".box-scale")).toHaveText("%100");
    await page.locator("#scale-fit").click();
    await expect(galaxy.locator(".box-scale")).toHaveText("%49");
});

test("döndürülmüş ve ölçeklenmiş görünümde WCAG 2.1 AA ihlali yok", async ({
    page,
}) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"], {
        rotated: ["iphone-17"],
        scale: 1.5,
    });
    await expect(scaleValue(page)).toHaveText("%150");
    const grid = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
    expect(grid.violations).toEqual([]);
    await page
        .locator(".view-toolbar")
        .getByRole("button", { name: "Tek cihaz", exact: true })
        .click();
    const single = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(single.violations).toEqual([]);
});
