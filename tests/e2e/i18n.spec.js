import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const TR_TITLE = "Sitenin responsive görünümünü test et";
const EN_TITLE = "Test how your site looks on any screen";

test.describe("tarayıcı dili Türkçe", () => {
    test.use({ locale: "tr-TR" });

    test("sayfa Türkçe açılır (NFR-4.2)", async ({ page }) => {
        await page.goto(APP_URL);
        await expect(page.locator("html")).toHaveAttribute("lang", "tr");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            TR_TITLE,
        );
    });

    test("dil düğmesiyle İngilizceye geçilir ve seçim hatırlanır (NFR-4.3)", async ({
        page,
    }) => {
        await page.goto(APP_URL);
        await page.getByRole("button", { name: "Switch to English" }).click();
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            EN_TITLE,
        );

        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
});

test.describe("tarayıcı dili İngilizce", () => {
    test.use({ locale: "en-US" });

    test("sayfa İngilizce açılır (NFR-4.2)", async ({ page }) => {
        await page.goto(APP_URL);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            EN_TITLE,
        );
    });
});
