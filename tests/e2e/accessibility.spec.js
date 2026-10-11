import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// NFR-5.1: WCAG 2.1 AA kurallarına göre otomatik tarama
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const APP_URL = "http://localhost:5173/";

async function expectNoViolations(page) {
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .exclude("#preview-iframe")
        .analyze();
    expect(results.violations).toEqual([]);
}

for (const locale of ["tr-TR", "en-US"]) {
    for (const colorScheme of ["light", "dark"]) {
        test.describe(`erişilebilirlik (${locale}, ${colorScheme})`, () => {
            test.use({ locale, colorScheme });

            test("boş durumda WCAG 2.1 AA ihlali yok", async ({ page }) => {
                await page.goto(APP_URL);
                await expectNoViolations(page);
            });

            test("önizleme açıkken WCAG 2.1 AA ihlali yok", async ({
                page,
            }) => {
                await page.goto(APP_URL);
                await page.locator("#url-input").fill("localhost:5174");
                await page.locator("#url-form button[type=submit]").click();
                await expect(page.locator("#device-frame")).toBeVisible();
                await expectNoViolations(page);
            });
        });
    }
}

test.describe("erişilebilirlik (dar ekran, panel açık)", () => {
    test.use({ viewport: { width: 375, height: 812 }, locale: "tr-TR" });

    test("WCAG 2.1 AA ihlali yok", async ({ page }) => {
        await page.goto(APP_URL);
        await page.locator("#sheet-toggle").click();
        await expectNoViolations(page);
    });
});
