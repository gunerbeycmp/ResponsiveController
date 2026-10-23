import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pickDevice } from "./menu.js";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const status = (page) => page.locator("#app-status");
const width = (page) => page.locator("#frame-width");
const height = (page) => page.locator("#frame-height");
const customRows = (page) =>
    page.locator("#device-list .device-row [data-device-id]");

async function openPreview(page) {
    await page.goto(APP_URL);
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

async function createFromTab(page, w, h) {
    await tab(page, "Özel").click();
    await page.locator("#custom-width").fill(String(w));
    await page.locator("#custom-height").fill(String(h));
    await page.getByRole("button", { name: "Oluştur" }).click();
}

test("Özel sekmesi boşken form, not ve yönlendirme gösterir (FR-3.11)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await tab(page, "Özel").click();
    await expect(page.locator(".custom-note")).toHaveText(
        "Özel boyutlar kaydedilmez, sayfa yenilenince silinir.",
    );
    await expect(page.locator("#device-list .search-empty")).toHaveText(
        "Henüz özel boyut yok. Genişlik ve yükseklik girip Oluştur'a bas ya da cihaz çerçevesini kenarından sürükle.",
    );
});

test("Özel sekmesinden boyut oluşturulur; sınır dışı değer hata verir", async ({
    page,
}) => {
    await openPreview(page);
    await createFromTab(page, 50, 700);
    await expect(page.locator("#custom-error")).toHaveText(
        "Genişlik ve yükseklik 100 ile 3840 px arasında olmalı.",
    );
    await expect(page.locator("#custom-width")).toHaveAttribute(
        "aria-invalid",
        "true",
    );
    await expect(page.locator("#custom-width")).toBeFocused();
    // Yazılan değerler hata sonrasında korunur
    await expect(page.locator("#custom-height")).toHaveValue("700");

    await page.locator("#custom-width").fill("500");
    await page.getByRole("button", { name: "Oluştur" }).click();
    await expect(status(page)).toHaveText("Özel boyut 1 oluşturuldu.");
    await expect(page.locator("#frame-name-button")).toHaveText("Özel boyut 1");
    await expect(width(page)).toHaveValue("500");
    await expect(height(page)).toHaveValue("700");
    await expect(customRows(page)).toHaveText([/Özel boyut 1\s*500 × 700/]);
    // Özel boyutlar favorilere eklenemez, ızgaraya eklenebilir
    await expect(page.locator("#device-list .favorite-toggle")).toHaveCount(0);
    await expect(page.locator("#device-list .grid-toggle")).toHaveCount(1);

    await createFromTab(page, 320, 480);
    await expect(customRows(page)).toHaveText([/Özel boyut 1/, /Özel boyut 2/]);
});

test("başlıktaki alanlar hazır cihazdan özel boyut türetir (FR-3.10, NFR-5.2)", async ({
    page,
}) => {
    await openPreview(page);
    await width(page).fill("500");
    await width(page).press("Enter");
    await expect(page.locator("#frame-name-button")).toHaveText(
        "iPhone 17 (özel)",
    );
    await expect(status(page)).toHaveText("iPhone 17 (özel) oluşturuldu.");
    await expect(width(page)).toHaveValue("500");
    await expect(height(page)).toHaveValue("874");
    // Hazır cihaz değişmez
    await tab(page, "Telefon").click();
    await expect(
        page.locator('#device-list [data-device-id="iphone-17"]').first(),
    ).toContainText("402 × 874");

    // Sonraki değişiklikler aynı özel boyutu değiştirir; ok tuşları uygular
    await width(page).focus();
    await page.keyboard.press("ArrowUp");
    await expect(width(page)).toHaveValue("501");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(width(page)).toHaveValue("511");
    await height(page).fill("600");
    await height(page).blur();
    await tab(page, "Özel").click();
    await expect(customRows(page)).toHaveText([
        /iPhone 17 \(özel\)\s*511 × 600/,
    ]);

    // Sınır dışı değer hata verir, boyut değişmez
    await width(page).fill("5000");
    await width(page).press("Enter");
    await expect(page.locator("#frame-size-error")).toHaveText(
        "Genişlik ve yükseklik 100 ile 3840 px arasında olmalı.",
    );
    await expect(width(page)).toHaveAttribute("aria-invalid", "true");
    await width(page).fill("520");
    await width(page).press("Enter");
    await expect(page.locator("#frame-size-error")).toBeHidden();

    // Aynı cihazdan ikinci türetme numaralanır
    await tab(page, "Telefon").click();
    await pickDevice(page, "iphone-17");
    await height(page).fill("700");
    await height(page).press("Enter");
    await expect(page.locator("#frame-name-button")).toHaveText(
        "iPhone 17 (özel 2)",
    );
});

test("çerçeve kenarından ve köşesinden sürüklenerek boyutlandırılır (FR-3.10)", async ({
    page,
}) => {
    await openPreview(page);
    const scaleText = await page.locator("#frame-scale").textContent();
    const scale = scaleText ? parseInt(scaleText.slice(1), 10) / 100 : 1;
    const drag = async (selector, dx, dy) => {
        const box = await page.locator(selector).boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 8 });
        await page.mouse.up();
    };
    await drag(".resize-x", -100, 0);
    await expect(page.locator("#frame-name-button")).toHaveText(
        "iPhone 17 (özel)",
    );
    const expected = Math.round(402 - 100 / scale);
    const value = Number(await width(page).inputValue());
    expect(Math.abs(value - expected)).toBeLessThanOrEqual(2);
    await expect(height(page)).toHaveValue("874");

    await drag(".resize-xy", -40, -40);
    expect(Number(await width(page).inputValue())).toBeLessThan(value);
    expect(Number(await height(page).inputValue())).toBeLessThan(874);
    // Aynı özel boyut değişti, yenisi oluşmadı
    await tab(page, "Özel").click();
    await expect(customRows(page)).toHaveCount(1);
});

test("ad düzenlenir: menüde ✎ ve başlıkta ada tıklayarak", async ({ page }) => {
    await openPreview(page);
    await createFromTab(page, 500, 700);
    await page
        .getByRole("button", { name: "Özel boyut 1 adını düzenle" })
        .first()
        .click();
    const input = page.getByRole("textbox", { name: "Özel boyutun adı" });
    await expect(input).toBeFocused();
    await input.fill("Kiosk");
    await input.press("Enter");
    await expect(customRows(page)).toHaveText([/Kiosk/]);
    await expect(
        page.getByRole("button", { name: "Kiosk adını düzenle" }).first(),
    ).toBeFocused();

    // Esc vazgeçer
    await page.locator(".custom-rename").click();
    await page.locator(".custom-name-input").fill("Başka");
    await page.locator(".custom-name-input").press("Escape");
    await expect(customRows(page)).toHaveText([/Kiosk/]);

    // Başlıkta ada tıklayarak
    await page.locator("#frame-name-button").click();
    await expect(page.locator("#frame-name-input")).toBeFocused();
    await page.locator("#frame-name-input").fill("Kiosk ekranı");
    await page.locator("#frame-name-input").press("Enter");
    await expect(page.locator("#frame-name-button")).toHaveText("Kiosk ekranı");
    await expect(page.locator("#frame-name-button")).toBeFocused();
    await expect(customRows(page)).toHaveText([/Kiosk ekranı/]);
});

test("silinen özel boyut ızgaradan kalkar, türetildiği cihaza dönülür", async ({
    page,
}) => {
    await openPreview(page);
    await width(page).fill("500");
    await width(page).press("Enter");
    await tab(page, "Özel").click();
    // Izgaraya ekle: tek cihaz modunda + ızgaraya geçer
    await page.locator("#device-list .grid-toggle").click();
    await expect(page.locator("#device-grid > li")).toHaveCount(1);
    await page
        .locator(".view-toolbar")
        .getByRole("button", { name: "Tek cihaz", exact: true })
        .click();

    await page
        .getByRole("button", { name: "iPhone 17 (özel) boyutunu sil" })
        .click();
    await expect(status(page)).toHaveText("iPhone 17 (özel) silindi.");
    await expect(page.locator("#frame-name")).toHaveText("iPhone 17");
    await expect(width(page)).toHaveValue("402");
    await expect(page.locator("#device-list .search-empty")).toBeVisible();
    await page
        .locator(".view-toolbar")
        .getByRole("button", { name: "Izgara", exact: true })
        .click();
    await expect(
        page.locator('#device-grid > li[data-grid-id^="custom-"]'),
    ).toHaveCount(0);
});

test("ad dil değişince çevrilir; sayfa yenilenince özel boyutlar silinir", async ({
    page,
}) => {
    await openPreview(page);
    await width(page).fill("500");
    await width(page).press("Enter");
    await createFromTab(page, 300, 300);
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(customRows(page)).toHaveText([
        /iPhone 17 \(custom\)/,
        /Custom size 1/,
    ]);
    await page.reload();
    await tab(page, "Custom").click();
    await expect(customRows(page)).toHaveCount(0);
});

test("türetilmiş özel boyuttan orijinale dönülür", async ({ page }) => {
    await openPreview(page);
    const restore = page.getByRole("button", { name: "Orijinale dön" });
    // Hazır cihazda görünmez
    await expect(restore).toBeHidden();
    await width(page).fill("500");
    await width(page).press("Enter");
    await expect(restore).toBeVisible();
    await expect(restore).toHaveAccessibleDescription("iPhone 17 cihazına dön");
    await restore.click();
    await expect(page.locator("#frame-name")).toHaveText("iPhone 17");
    await expect(width(page)).toHaveValue("402");
    await expect(restore).toBeHidden();
    await expect(width(page)).toBeFocused();
    // Özel boyut listede kalır, tekrar seçilince düğme geri gelir
    await tab(page, "Özel").click();
    await customRows(page).first().click();
    await expect(width(page)).toHaveValue("500");
    await expect(restore).toBeVisible();

    // Özel sekmesinden sıfırdan oluşturulanda görünmez
    await createFromTab(page, 300, 300);
    await expect(restore).toBeHidden();
});

test("Özel sekmesi ve hata durumunda WCAG 2.1 AA ihlali yok", async ({
    page,
}) => {
    await openPreview(page);
    await createFromTab(page, 500, 700);
    await createFromTab(page, 50, 50);
    await width(page).fill("5000");
    await width(page).press("Enter");
    await page.locator(".custom-rename").click();
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
