import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pickDevice } from "./menu.js";

const expectFrameSize = async (page, text) => {
    const [width, height] = text.split(" × ");
    await expect(page.locator("#frame-width")).toHaveValue(width);
    await expect(page.locator("#frame-height")).toHaveValue(height);
};

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR" });

const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const groupTitles = (page) => page.locator("#device-list .group-title");
const device = (page, id) =>
    page.locator(`#device-list [data-device-id="${id}"]`).first();

async function openPreview(page) {
    await page.goto(APP_URL);
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

test("sekmeler ve gruplar (FR-3.1, FR-3.3, FR-3.4)", async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.getByRole("tab")).toHaveText([
        "Favoriler",
        "Telefon",
        "Tablet",
        "Saat",
        "TV",
        "Bilgisayar",
        "Özel",
    ]);
    await expect(tab(page, "Telefon")).toHaveAttribute("aria-selected", "true");
    // Marka başlıklarında cihaz sayısı (Aşama 6 revizyonu)
    await expect(groupTitles(page)).toHaveText([
        "Popüler",
        "Apple23",
        "Samsung18",
        "Google11",
        "OnePlus2",
        "Genel boyutlar",
    ]);
    // Popüler etiketi marka grubunda görünür, Popüler grubunda tekrar edilmez
    const apple = page.locator(".device-group", { hasText: "Apple" });
    await expect(
        apple.locator('[data-device-id="iphone-17"] .badge'),
    ).toHaveText("Popüler");
    // Katlanabilir etiketi
    await expect(
        device(page, "galaxy-z-fold-7-open").locator(".badge"),
    ).toHaveText("Katlanabilir");

    await tab(page, "Tablet").click();
    await expect(tab(page, "Tablet")).toHaveAttribute("aria-selected", "true");
    await expect(device(page, "ipad-11th-gen")).toContainText(
        "iPad (11. nesil)",
    );
});

test("sekmeler klavyeyle değiştirilir (WAI-ARIA)", async ({ page }) => {
    await page.goto(APP_URL);
    await tab(page, "Telefon").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Tablet")).toBeFocused();
    await expect(tab(page, "Tablet")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tab(page, "Özel")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Favoriler")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Özel")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Bilgisayar")).toBeFocused();
});

test("arama tüm kategorilerde sonuç verir, boş sonuçta mesaj gösterir", async ({
    page,
}) => {
    await page.goto(APP_URL);
    const search = page.getByLabel("Cihaz ara");
    await search.fill("samsung");
    await expect(groupTitles(page)).toHaveText(["Telefon", "Tablet", "Saat"]);
    await search.fill("1920 x 1080");
    await expect(page.locator("#device-list")).toContainText("TV (Full HD)");
    await search.fill("nokia 3310");
    await expect(page.locator(".search-empty")).toHaveText(
        '"nokia 3310" ile eşleşen cihaz yok.',
    );
    await search.fill("");
    await expect(groupTitles(page).first()).toHaveText("Popüler");
});

test("bilgisayar sekmesinde çözünürlük satırı açılır ve cihaz seçilir (FR-3.1)", async ({
    page,
}) => {
    await openPreview(page);
    await tab(page, "Bilgisayar").click();
    const row = page.locator(".resolution-row", {
        has: page.locator('[data-device-id="1440-x-900"]'),
    });
    const toggle = row.locator(".resolution-toggle");
    await expect(toggle).toHaveText("1 cihaz");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await row
        .locator('[data-device-id="macbook-air-pro-13-2560-x-1600-display"]')
        .click();
    await expect(page.locator("#frame-name")).toHaveText(
        "MacBook Air / Pro 13 (2560 × 1600 ekran)",
    );
    await expectFrameSize(page, "1440 × 900");
    // Cihazı olmayan çözünürlükte açma düğmesi yok
    const plain = page.locator(".resolution-row", {
        has: page.locator('[data-device-id="1280-x-720"]'),
    });
    await expect(plain.locator(".resolution-toggle")).toHaveCount(0);
});

test("Apple Watch sayfayı 320 px'te çizip küçültür", async ({ page }) => {
    await openPreview(page);
    await tab(page, "Saat").click();
    await pickDevice(page, "apple-watch-44-mm");
    await expectFrameSize(page, "184 × 224");
    await expect(page.locator("#frame-note")).toBeVisible();
    const iframe = page.locator("#preview-iframe");
    await expect(iframe).toHaveCSS("width", "320px");
    await expect(iframe).toHaveCSS("height", "390px");
    const box = await page.locator("#frame-viewport").boundingBox();
    expect(Math.round(box.width)).toBe(184 + 2);

    await pickDevice(page, "galaxy-watch");
    await expect(page.locator("#frame-note")).toBeHidden();
    await expect(iframe).toHaveCSS("width", "180px");
});

test("ad İngilizcede çevrilir", async ({ browser }) => {
    const page = await browser.newPage({ locale: "en-US" });
    await page.goto(APP_URL);
    await page.getByRole("tab", { name: "Tablet" }).click();
    await expect(device(page, "ipad-11th-gen")).toContainText(
        "iPad (11th gen)",
    );
    await expect(page.locator("#device-list .group-title").last()).toHaveText(
        "Generic sizes",
    );
    await page.close();
});

for (const name of ["Telefon", "Bilgisayar"]) {
    test(`${name} sekmesinde WCAG 2.1 AA ihlali yok`, async ({ page }) => {
        await page.goto(APP_URL);
        await tab(page, name).click();
        if (name === "Bilgisayar") {
            await page.locator(".resolution-toggle").first().click();
        }
        const results = await new AxeBuilder({ page })
            .withTags(WCAG_21_AA)
            .exclude("#preview-iframe")
            .analyze();
        expect(results.violations).toEqual([]);
    });
}

test("marka grupları açılır-kapanır; seçili cihazın markası açık, seçim hatırlanır (Aşama 6 revizyonu)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    const toggle = (name) =>
        page
            .locator("#device-list .group-toggle")
            .filter({ hasText: new RegExp(`^${name}\\d+$`) });
    // Seçili cihaz (iPhone 17) Apple grubunda: yalnızca Apple açık
    await expect(toggle("Apple")).toHaveAttribute("aria-expanded", "true");
    await expect(toggle("Samsung")).toHaveAttribute("aria-expanded", "false");
    const samsungList = page.locator(
        `#${await toggle("Samsung").getAttribute("aria-controls")}`,
    );
    await expect(samsungList).toBeHidden();

    // Klavyeyle açılır
    await toggle("Samsung").focus();
    await page.keyboard.press("Enter");
    await expect(toggle("Samsung")).toHaveAttribute("aria-expanded", "true");
    await expect(samsungList).toBeVisible();
    await expect(toggle("Samsung")).toBeFocused();
    await toggle("Apple").click();
    await expect(toggle("Apple")).toHaveAttribute("aria-expanded", "false");

    // Sayfa yenilense de kalır; diğer sekmeler bağımsız
    await page.reload();
    await expect(toggle("Apple")).toHaveAttribute("aria-expanded", "false");
    await expect(toggle("Samsung")).toHaveAttribute("aria-expanded", "true");
    await tab(page, "Tablet").click();
    await expect(toggle("Apple")).toHaveAttribute("aria-expanded", "false");
    await expect(
        page.locator("#device-list .group-toggle").first(),
    ).toHaveAttribute("aria-controls", /group-tablet-/);

    const results = await new AxeBuilder({ page })
        .include("#device-list")
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
