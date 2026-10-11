import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// NFR-5.1: WCAG 2.1 AA kurallarına göre otomatik tarama
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const locale of ["tr-TR", "en-US"]) {
    test.describe(`erişilebilirlik (${locale})`, () => {
        test.use({ locale });

        test("araç sitesinde WCAG 2.1 AA ihlali yok", async ({ page }) => {
            await page.goto("http://localhost:5173/");
            const results = await new AxeBuilder({ page })
                .withTags(WCAG_21_AA)
                .analyze();
            expect(results.violations).toEqual([]);
        });
    });
}
