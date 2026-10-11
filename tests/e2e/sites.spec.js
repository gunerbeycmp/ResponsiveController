import { expect, test } from "@playwright/test";

// Kurulum kontrolü: iki site de açılıyor mu?
test("araç sitesi açılıyor", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    await expect(page).toHaveTitle("ResponsiveController");
});

test("önizleme sitesi açılıyor", async ({ page }) => {
    await page.goto("http://localhost:5174/");
    await expect(page).toHaveTitle("ResponsiveController Preview");
});
