import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const TARGET = "localhost:5174";

test.use({ locale: "tr-TR" });

async function openTarget(page) {
    await page.goto(APP_URL);
    await page.getByLabel("Test edilecek sitenin adresi").fill(TARGET);
    await page.getByRole("button", { name: "Aç" }).click();
}

test("URL girilince seçili cihazda önizleme açılır (FR-2.1)", async ({
    page,
}) => {
    await openTarget(page);
    const iframe = page.locator("#preview-iframe");
    await expect(iframe).toHaveAttribute("src", "http://localhost:5174/");
    await expect(page.locator("#frame-size")).toHaveText("402 × 874");
    await expect(
        page.frameLocator("#preview-iframe").locator("body"),
    ).toContainText("önizleme sitesi çalışıyor");
    // iframe gerçek cihaz boyutunda olmalı, yalnızca görsel olarak küçültülür
    await expect(iframe).toHaveCSS("width", "402px");
    await expect(iframe).toHaveCSS("height", "874px");
});

test("geçersiz adreste hata mesajı gösterilir", async ({ page }) => {
    await page.goto(APP_URL);
    await page.getByLabel("Test edilecek sitenin adresi").fill("192.168.1.5");
    await page.getByRole("button", { name: "Aç" }).click();
    await expect(page.locator("#url-error")).toContainText(
        "Yerel ağ adresleri",
    );
    await expect(
        page.getByLabel("Test edilecek sitenin adresi"),
    ).toHaveAttribute("aria-invalid", "true");
});

test("cihaz seçimi ve tarayıcı çubukları görünümü (FR-3.14)", async ({
    page,
}) => {
    await openTarget(page);
    await page
        .getByRole("checkbox", { name: "Tarayıcı çubukları dahil" })
        .check();
    await expect(page.locator("#frame-size")).toHaveText("402 × 681");

    await page.getByRole("button", { name: /Masaüstü/ }).click();
    await expect(page.locator("#frame-size")).toHaveText("1920 × 1080");
    await expect(page.locator("#browser-bars-option")).toBeHidden();

    await page.getByRole("button", { name: /Galaxy S24/ }).click();
    await expect(page.locator("#browser-bars-estimated")).toHaveText("tahmini");
});

test("tema düğmesi temayı değiştirir ve seçim hatırlanır (NFR-6.2)", async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(APP_URL);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: "Koyu temaya geç" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
});

test.describe("dar ekran", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("cihazlar alttan açılan panelde, klavyeyle kapanır (R-51)", async ({
        page,
    }) => {
        await page.goto(APP_URL);
        const toggle = page.locator("#sheet-toggle");
        await expect(toggle).toHaveAccessibleName("Cihazları göster");
        await expect(page.locator("#device-list")).toBeHidden();

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(toggle).toHaveAccessibleName("Cihazları gizle");
        await expect(page.locator("#device-list")).toBeVisible();
        await expect(
            page.getByRole("button", { name: /iPhone 17/ }),
        ).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toBeFocused();
    });
});
