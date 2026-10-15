import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR" });

const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const groupTitles = (page) => page.locator("#device-list .group-title");
const star = (page, id) =>
    page.locator(`#device-list .favorite-toggle[data-favorite-id="${id}"]`);
const handle = (page, id) => page.locator(`[data-handle-id="${id}"]`);
const status = (page) => page.locator("#sidebar-status");
const opacity = (locator) =>
    locator.evaluate((node) => getComputedStyle(node).opacity);

// Favorileri tarayıcı deposuna yazıp sayfayı yeniden yükler
async function withFavorites(page, ids, frequent = []) {
    await page.goto(APP_URL);
    await page.evaluate(
        (value) => localStorage.setItem("rc-favorites", value),
        JSON.stringify({ ids, frequent }),
    );
    await page.reload();
}

// Sortable'ın fare olaylarıyla sürükleme (forceFallback); bırakma alanı
// sürükleme başlayınca belirdiği için hedef konum sonra ölçülür
async function drag(page, from, to, { top = false } = {}) {
    const start = await from.boundingBox();
    await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2 + 8,
        { steps: 4 },
    );
    const end = await to.boundingBox();
    const x = end.x + end.width / 2;
    await page.mouse.move(x, end.y + end.height / 2, { steps: 12 });
    // Hedefin üst kenarına doğru ilerlemek öğeyi hedefin önüne yerleştirir
    if (top) await page.mouse.move(x, end.y + 4, { steps: 6 });
    await page.mouse.up();
    // Liste bırakmadan hemen sonra (bir sonraki görevde) yeniden çizilir
    await page.waitForTimeout(100);
}

test("favori yokken Favoriler sekmesi boş mesajı gösterir", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await expect(page.getByRole("tab").first()).toHaveText("Favoriler");
    // Favori yokken seçili cihazın sekmesi açılır
    await expect(tab(page, "Telefon")).toHaveAttribute("aria-selected", "true");
    await tab(page, "Favoriler").click();
    await expect(page.locator("#device-list")).toHaveText(
        "Henüz favori yok. Bir cihazın yanındaki ☆ simgesiyle ekleyebilirsin.",
    );
});

test("yıldız üzerine gelince görünür, favori eklenir ve hatırlanır (FR-3.2)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    const apple = page.locator(".device-group", { hasText: "Apple" });
    const iphone = apple.locator(
        '.favorite-toggle[data-favorite-id="iphone-17"]',
    );
    expect(await opacity(iphone)).toBe("0");
    await apple.locator('[data-device-id="iphone-17"]').hover();
    expect(await opacity(iphone)).toBe("1");
    await expect(iphone).toHaveAccessibleName(
        "iPhone 17 cihazını favorilere ekle",
    );

    await iphone.click();
    await expect(status(page)).toHaveText("iPhone 17 favorilere eklendi.");
    await expect(iphone).toHaveText("★");
    await expect(iphone).toHaveAccessibleName(
        "iPhone 17 cihazını favorilerden çıkar",
    );
    // Favorideki cihazın yıldızı her yerde ve her zaman görünür
    await page.mouse.move(700, 400);
    for (const s of await star(page, "iphone-17").all())
        expect(await opacity(s)).toBe("1");

    await tab(page, "Tablet").click();
    await star(page, "ipad-11th-gen").first().click();
    await page.getByRole("searchbox").fill("s24");
    await star(page, "galaxy-s24").click();
    await page.getByRole("searchbox").fill("");

    await tab(page, "Favoriler").click();
    await expect(groupTitles(page)).toHaveText(["Telefon", "Tablet"]);
    await expect(
        page.locator(".device-group").first().locator("[data-device-id]"),
    ).toHaveCount(2);

    // Yeniden yüklenince favoriler hatırlanır ve Favoriler sekmesi açılır
    await page.reload();
    await expect(tab(page, "Favoriler")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(page.locator("#device-list [data-device-id]")).toHaveCount(3);
});

test("yıldız klavyeyle kullanılır, odak korunur", async ({ page }) => {
    await withFavorites(page, ["iphone-17", "galaxy-s24"]);
    // Klavyeyle satıra gelince yıldız görünür
    await tab(page, "Telefon").click();
    const button = page
        .locator('#device-list [data-device-id="iphone-16"]')
        .first();
    await button.focus();
    const iphone16 = star(page, "iphone-16").first();
    expect(await opacity(iphone16)).toBe("1");
    // Satırda önce ızgara (+) düğmesi, sonra yıldız gelir (v0.3.4)
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(iphone16).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(iphone16).toBeFocused();
    await expect(iphone16).toHaveText("★");

    // Favoriler sekmesinden çıkarılınca odak sıradaki yıldıza geçer
    await tab(page, "Favoriler").click();
    await star(page, "iphone-17").focus();
    await page.keyboard.press("Enter");
    await expect(status(page)).toHaveText("iPhone 17 favorilerden çıkarıldı.");
    await expect(star(page, "iphone-17")).toHaveCount(0);
    await expect(star(page, "galaxy-s24")).toBeFocused();
});

test("dokunmatik ekranda yıldızlar her zaman görünür (R-59)", async ({
    browser,
    browserName,
}) => {
    test.skip(browserName === "firefox", "Firefox mobil öykünmeyi desteklemez");
    const context = await browser.newContext({
        locale: "tr-TR",
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(APP_URL);
    await page.locator("#sheet-toggle").click();
    const first = star(page, "iphone-17").first();
    await expect(first).toBeVisible();
    expect(await opacity(first)).toBe("1");
    await first.tap();
    await expect(first).toHaveText("★");
    await context.close();
});

test("taşıma menüsü klavyeyle sık kullanılanları düzenler (NFR-5.2)", async ({
    page,
}) => {
    await withFavorites(page, ["iphone-17", "galaxy-s24", "ipad-11th-gen"]);
    await expect(groupTitles(page)).toHaveText(["Telefon", "Tablet"]);

    await handle(page, "galaxy-s24").click();
    await expect(handle(page, "galaxy-s24")).toHaveAttribute(
        "aria-expanded",
        "true",
    );
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText([
        "Sık kullanılanlara taşı",
    ]);
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(groupTitles(page)).toHaveText([
        "Sık kullanılan favoriler",
        "Telefon",
        "Tablet",
    ]);
    await expect(handle(page, "galaxy-s24")).toBeFocused();
    await expect(status(page)).toHaveText("Galaxy S24 1. sıraya taşındı.");

    await handle(page, "ipad-11th-gen").click();
    await page.keyboard.press("Enter");
    // iPad'i yukarı taşı: menüde Çıkar ve Yukarı taşı var (son sırada)
    await handle(page, "ipad-11th-gen").press("Enter");
    await expect(page.getByRole("menuitem")).toHaveText([
        "Sık kullanılanlardan çıkar",
        "Yukarı taşı",
    ]);
    await page.keyboard.press("ArrowDown");
    await expect(
        page.getByRole("menuitem", { name: "Yukarı taşı" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(status(page)).toHaveText(
        "iPad (11. nesil) 1. sıraya taşındı.",
    );
    const frequent = page.locator('ul[data-zone="frequent"] [data-device-id]');
    await expect(frequent).toHaveText([/iPad/, /Galaxy S24/]);

    // Esc menüyü kapatır, odak tutamaca döner
    await handle(page, "galaxy-s24").press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(handle(page, "galaxy-s24")).toBeFocused();

    // Sık kullanılanlardan çıkarılan cihaz kategorisine döner
    await handle(page, "galaxy-s24").press("Enter");
    await page
        .getByRole("menuitem", { name: "Sık kullanılanlardan çıkar" })
        .click();
    await expect(frequent).toHaveText([/iPad/]);
    await expect(groupTitles(page)).toHaveText([
        "Sık kullanılan favoriler",
        "Telefon",
    ]);

    // Sıra yeniden yüklemede korunur
    await page.reload();
    await expect(frequent).toHaveText([/iPad/]);
});

test("sürükleyerek sık kullanılan favoriler oluşturulur (FR-3.2)", async ({
    page,
}) => {
    await withFavorites(page, ["iphone-17", "galaxy-s24", "ipad-11th-gen"]);
    // Bırakma alanı yalnızca sürükleme sırasında görünür
    await expect(page.locator(".frequent-drop")).toBeHidden();

    await drag(
        page,
        handle(page, "galaxy-s24"),
        page.locator(".frequent-drop .device-list"),
    );
    const frequent = page.locator('ul[data-zone="frequent"] [data-device-id]');
    await expect(frequent).toHaveText([/Galaxy S24/]);
    await expect(groupTitles(page).first()).toHaveText(
        "Sık kullanılan favoriler",
    );

    // Sık kullanılanların üstüne bırakılan cihaz ilk sıraya girer
    await drag(page, handle(page, "ipad-11th-gen"), frequent.first(), {
        top: true,
    });
    await expect(frequent).toHaveText([/iPad/, /Galaxy S24/]);

    // Kategori grubuna geri sürüklenen cihaz sık kullanılanlardan çıkar
    await drag(
        page,
        handle(page, "galaxy-s24"),
        page.locator('ul[data-zone="category"]').first(),
    );
    await expect(frequent).toHaveText([/iPad/]);

    await page.reload();
    await expect(frequent).toHaveText([/iPad/]);
});

test("Favoriler sekmesinde WCAG 2.1 AA ihlali yok", async ({ page }) => {
    await withFavorites(page, ["iphone-17", "galaxy-s24"], ["galaxy-s24"]);
    await handle(page, "iphone-17").click();
    await expect(page.getByRole("menu")).toBeVisible();
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
