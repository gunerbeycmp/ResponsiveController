import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const PREVIEW = "http://localhost:5174/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

async function openPreview(page) {
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

// Önizleme sayfasının yanıtı elle bırakılana kadar bekletilir
async function holdPreview(page) {
    let release;
    const released = new Promise((resolve) => {
        release = resolve;
    });
    await page.route(`${PREVIEW}**`, async (route) => {
        await released;
        await route.continue();
    });
    return () => release();
}

test("tek cihazda sayfa yüklenirken gösterge, yüklenince kalkar (Aşama 6 revizyonu)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    const release = await holdPreview(page);
    await openPreview(page);
    const loading = page.locator("#preview-loading");
    await expect(loading).toBeVisible();
    await expect(loading).toHaveText("Yükleniyor…");
    await expect(page.locator("#frame-viewport")).toHaveAttribute(
        "aria-busy",
        "true",
    );
    // Sesli duyuru yapılmaz
    await expect(page.locator("#app-status")).not.toHaveText(/Yükleniyor/);
    const results = await new AxeBuilder({ page })
        .include("#device-frame")
        .exclude("#preview-iframe")
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);

    release();
    await expect(loading).toBeHidden();
    await expect(page.locator("#frame-viewport")).not.toHaveAttribute(
        "aria-busy",
    );
});

test("ızgarada her kutunun kendi göstergesi (Aşama 6 revizyonu)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await page.evaluate(() =>
        localStorage.setItem(
            "rc-grid",
            JSON.stringify({
                ids: ["iphone-17", "galaxy-s25"],
                mode: "grid",
                size: "medium",
            }),
        ),
    );
    await page.reload();
    const release = await holdPreview(page);
    await openPreview(page);
    const indicators = page.locator("#device-grid .preview-loading");
    await expect(indicators).toHaveCount(2);
    await expect(indicators.first()).toBeVisible();
    await expect(indicators.nth(1)).toHaveText("Yükleniyor…");
    release();
    await expect(indicators.first()).toBeHidden();
    await expect(indicators.nth(1)).toBeHidden();
});

test("site yanıt vermezse gösterge 20 saniye sonra kalkar (Aşama 6 revizyonu)", async ({
    page,
}) => {
    await page.clock.install();
    await page.goto(APP_URL);
    await holdPreview(page);
    await openPreview(page);
    const loading = page.locator("#preview-loading");
    await expect(loading).toBeVisible();
    await page.clock.runFor(19000);
    await expect(loading).toBeVisible();
    await page.clock.runFor(1500);
    await expect(loading).toBeHidden();
});
