import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const status = (page) => page.locator('[data-i18n="app.status"]');

test.describe("tarayıcı dili Türkçe", () => {
    test.use({ locale: "tr-TR" });

    test("sayfa Türkçe açılır (NFR-4.2)", async ({ page }) => {
        await page.goto(APP_URL);
        await expect(page.locator("html")).toHaveAttribute("lang", "tr");
        await expect(status(page)).toHaveText(
            "ResponsiveController: araç sitesi çalışıyor.",
        );
    });

    test("seçilen dil sonraki ziyarette hatırlanır (NFR-4.3)", async ({
        page,
    }) => {
        await page.goto(APP_URL);
        await page.evaluate(() => localStorage.setItem("rc-language", "en"));
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(status(page)).toHaveText(
            "ResponsiveController: the app site is running.",
        );
    });
});

test.describe("tarayıcı dili İngilizce", () => {
    test.use({ locale: "en-US" });

    test("sayfa İngilizce açılır (NFR-4.2)", async ({ page }) => {
        await page.goto(APP_URL);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(status(page)).toHaveText(
            "ResponsiveController: the app site is running.",
        );
    });
});
