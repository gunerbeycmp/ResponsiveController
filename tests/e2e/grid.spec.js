import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

const box = (page, id) =>
    page.locator(`#device-grid > li[data-grid-id="${id}"]`);
const boxIds = (page) =>
    page
        .locator("#device-grid > li:not([hidden])")
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.gridId));
const plus = (page, id) =>
    page.locator(`#device-list [data-grid-toggle="${id}"]`).first();
const row = (page, id) =>
    page.locator(`#device-list [data-device-id="${id}"]`).first();
const status = (page) => page.locator("#app-status");
const viewButton = (page, name) =>
    page.locator(".view-toolbar").getByRole("button", { name, exact: true });

async function openPreview(page) {
    await page.goto(APP_URL);
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

// Izgarayı tarayıcı deposuna yazıp adresi açar
async function withGrid(page, ids, size = "medium") {
    await page.goto(APP_URL);
    await page.evaluate(
        (value) => localStorage.setItem("rc-grid", value),
        JSON.stringify({ ids, mode: "grid", size }),
    );
    await openPreview(page);
}

test("araç çubuğu adres açılınca görünür, varsayılan tek cihaz", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await expect(page.locator("#view-toolbar")).toBeHidden();
    await openPreview(page);
    await expect(viewButton(page, "Tek cihaz")).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(page.locator("#size-group")).toBeHidden();
    await expect(page.locator("#device-frame")).toBeVisible();
});

test("tek cihaz modunda + ızgaraya geçer, iki cihaz yan yana (FR-3.7)", async ({
    page,
}) => {
    await openPreview(page);
    await plus(page, "galaxy-s24").click();
    await expect(viewButton(page, "Izgara")).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(page.locator("#device-frame")).toBeHidden();
    expect(await boxIds(page)).toEqual(["iphone-17", "galaxy-s24"]);
    await expect(status(page)).toHaveText("Galaxy S24 ızgaraya eklendi.");
    await expect(box(page, "galaxy-s24").locator("iframe")).toHaveAttribute(
        "src",
        "http://localhost:5174/",
    );
    // Menüde ızgaradaki cihaz ✓ olur ve satırı basılı görünür
    await expect(plus(page, "galaxy-s24")).toHaveText("✓");
    await expect(plus(page, "galaxy-s24")).toHaveAccessibleName(
        "Galaxy S24 cihazını ızgaradan çıkar",
    );
    await expect(row(page, "galaxy-s24")).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(plus(page, "galaxy-s24")).toBeFocused();
});

test("ızgara modunda satıra tıklamak ekler ve çıkarır", async ({ page }) => {
    await withGrid(page, ["iphone-17"]);
    await row(page, "iphone-16").click();
    expect(await boxIds(page)).toEqual(["iphone-17", "iphone-16"]);
    await expect(row(page, "iphone-16")).toBeFocused();
    await row(page, "iphone-16").click();
    expect(await boxIds(page)).toEqual(["iphone-17"]);
    await expect(status(page)).toHaveText("iPhone 16 ızgaradan çıkarıldı.");
    await plus(page, "iphone-17").click();
    await expect(page.locator("#grid-empty")).toHaveText(
        "Izgarada cihaz yok. Menüden bir cihaz ekle ya da buraya sürükle.",
    );
});

test("boş ızgaraya geçilince açık cihaz eklenir; tek cihaza dönülür", async ({
    page,
}) => {
    await openPreview(page);
    await viewButton(page, "Izgara").click();
    expect(await boxIds(page)).toEqual(["iphone-17"]);
    await expect(page.locator("#size-group")).toBeVisible();
    await viewButton(page, "Tek cihaz").click();
    await expect(page.locator("#device-frame")).toBeVisible();
    // Tek cihaz modunda ızgaranın iframe'leri kaldırılır
    await expect(page.locator("#device-grid iframe")).toHaveCount(0);
});

test("kutu boyutu seçilir; ızgara yeniden yüklemede hatırlanır", async ({
    page,
}) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"]);
    const viewport = box(page, "iphone-17").locator(".box-viewport");
    await expect(viewport).toHaveCSS("width", "300px");
    await page.getByRole("button", { name: "Küçük", exact: true }).click();
    await expect(viewport).toHaveCSS("width", "220px");
    await page.getByRole("button", { name: "Büyük", exact: true }).click();
    await expect(viewport).toHaveCSS("width", "420px");

    await page.reload();
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
    expect(await boxIds(page)).toEqual(["iphone-17", "galaxy-s24"]);
    await expect(
        page.getByRole("button", { name: "Büyük", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
});

test("kutu içinde yakınlaştırma düğmeleri ve Sığdır (FR-3.9)", async ({
    page,
}) => {
    await withGrid(page, ["iphone-17"]);
    const b = box(page, "iphone-17");
    const scale = b.locator(".box-scale");
    const zoomIn = b.getByRole("button", { name: "Yakınlaştır" });
    const zoomOut = b.getByRole("button", { name: "Uzaklaştır" });
    const fit = b.getByRole("button", { name: "Sığdır" });
    // 402 × 874 ekran 300 × 380 kutuya sığar: %43
    await expect(scale).toHaveText("%43");
    await expect(fit).toBeDisabled();
    await zoomIn.click();
    await expect(scale).toHaveText("%50");
    await expect(fit).toBeEnabled();
    // Yakınlaşınca kutunun içi kaydırılabilir
    const viewport = b.locator(".box-viewport");
    expect(
        await viewport.evaluate((n) => n.scrollHeight > n.clientHeight),
    ).toBe(true);
    // Uzaklaştırma bir alt adıma (%25) iner
    await zoomOut.click();
    await expect(scale).toHaveText("%25");
    await expect(zoomOut).toBeDisabled();
    await fit.click();
    await expect(scale).toHaveText("%43");
    for (let i = 0; i < 6; i += 1) await zoomIn.click({ force: true });
    await expect(scale).toHaveText("%200");
    await expect(zoomIn).toBeDisabled();
});

test("Ctrl + tekerlek kutu başlığında yakınlaştırır (R-61)", async ({
    page,
}) => {
    await withGrid(page, ["iphone-17"]);
    const b = box(page, "iphone-17");
    await b.locator(".box-info").hover();
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect(b.locator(".box-scale")).not.toHaveText("%43");
    const value = parseInt(
        (await b.locator(".box-scale").textContent()).slice(1),
        10,
    );
    expect(value).toBeGreaterThan(43);
});

test("kutu büyütülür ve küçültülür", async ({ page }) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"]);
    const expand = box(page, "galaxy-s24").getByRole("button", {
        name: "Galaxy S24 kutusunu büyüt",
    });
    await expand.click();
    await expect(box(page, "iphone-17")).toBeHidden();
    const collapse = box(page, "galaxy-s24").getByRole("button", {
        name: "Galaxy S24 kutusunu küçült",
    });
    await expect(collapse).toBeFocused();
    const width = await box(page, "galaxy-s24")
        .locator(".box-viewport")
        .evaluate((n) => n.offsetWidth);
    expect(width).toBeGreaterThan(600);
    await collapse.click();
    await expect(box(page, "iphone-17")).toBeVisible();
    await expect(box(page, "galaxy-s24").locator(".box-viewport")).toHaveCSS(
        "width",
        "300px",
    );
});

test("kutu kaldırılır, odak sıradaki kutuya geçer", async ({ page }) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"]);
    await box(page, "iphone-17")
        .getByRole("button", { name: "iPhone 17 cihazını ızgaradan çıkar" })
        .click();
    expect(await boxIds(page)).toEqual(["galaxy-s24"]);
    await expect(status(page)).toHaveText("iPhone 17 ızgaradan çıkarıldı.");
    await expect(
        box(page, "galaxy-s24").getByRole("button", {
            name: "Galaxy S24 cihazını ızgaradan çıkar",
        }),
    ).toBeFocused();
});

test("taşıma menüsü klavyeyle kutuları sıralar (NFR-5.2)", async ({ page }) => {
    await withGrid(page, ["iphone-17", "galaxy-s24", "ipad-11th-gen"]);
    const handle = (id) => box(page, id).locator(".box-handle");
    await handle("iphone-17").click();
    await expect(page.getByRole("menuitem")).toHaveText(["Sağa taşı"]);
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await boxIds(page)).toEqual([
        "galaxy-s24",
        "iphone-17",
        "ipad-11th-gen",
    ]);
    await expect(status(page)).toHaveText("iPhone 17 2. sıraya taşındı.");
    await expect(handle("iphone-17")).toBeFocused();

    await handle("iphone-17").press("Enter");
    await expect(page.getByRole("menuitem")).toHaveText([
        "Sola taşı",
        "Sağa taşı",
    ]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(handle("iphone-17")).toBeFocused();
});

async function drag(page, from, to) {
    const start = await from.boundingBox();
    await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        start.x + start.width / 2 + 10,
        start.y + start.height / 2 + 10,
        { steps: 4 },
    );
    const end = await to.boundingBox();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
        steps: 12,
    });
    await page.mouse.up();
    // Liste bırakmadan hemen sonra (bir sonraki görevde) yeniden çizilir
    await page.waitForTimeout(100);
}

test("kutular tutamaçtan sürüklenerek sıralanır (FR-3.7)", async ({ page }) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"], "small");
    await drag(
        page,
        box(page, "galaxy-s24").locator(".box-handle"),
        box(page, "iphone-17").locator(".box-info"),
    );
    expect(await boxIds(page)).toEqual(["galaxy-s24", "iphone-17"]);
});

test("menüden önizleme alanına sürüklenen cihaz ızgaraya eklenir (FR-3.7)", async ({
    page,
}) => {
    await openPreview(page);
    await expect(page.locator("#grid-drop-zone")).toBeHidden();
    await drag(page, row(page, "galaxy-s24"), page.locator("#stage"));
    expect(await boxIds(page)).toEqual(["iphone-17", "galaxy-s24"]);
    await expect(page.locator("#grid-drop-zone")).toBeHidden();
    // Tıklama sürükleme sayılmaz: ızgara modunda satır tıklaması çalışır
    await row(page, "iphone-16").click();
    expect(await boxIds(page)).toEqual([
        "iphone-17",
        "galaxy-s24",
        "iphone-16",
    ]);
});

test("dokunmatik ekranda + görünür ve menüden sürükleme kapalı (R-60)", async ({
    browser,
    browserName,
}) => {
    test.skip(browserName === "firefox", "Firefox mobil öykünmeyi desteklemez");
    const context = await browser.newContext({
        locale: "tr-TR",
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
        isMobile: true,
    });
    const page = await context.newPage();
    await openPreview(page);
    const button = plus(page, "galaxy-s24");
    expect(await button.evaluate((n) => getComputedStyle(n).opacity)).toBe("1");
    // Menü listelerine sürükleme bağlanmaz
    expect(
        await page
            .locator("#device-list ul.device-list")
            .first()
            .evaluate((n) =>
                Object.keys(n).some((key) => key.startsWith("Sortable")),
            ),
    ).toBe(false);
    await button.tap();
    expect(await boxIds(page)).toEqual(["iphone-17", "galaxy-s24"]);
    await context.close();
});

test("yavaşlama uyarısı gösterilir ve kapatılır (FR-3.8)", async ({ page }) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"]);
    // Ana iş parçacığını meşgul ederek FPS'i düşürür
    await page.evaluate(() => {
        window.__busy = setInterval(() => {
            const start = performance.now();
            while (performance.now() - start < 80);
        }, 0);
    });
    const warning = page.locator("#slow-warning");
    await expect(warning).toBeVisible({ timeout: 10000 });
    await expect(warning).toContainText("Önizleme yavaşladı.");
    await page.evaluate(() => clearInterval(window.__busy));
    await warning.getByRole("button", { name: "Uyarıyı kapat" }).click();
    await expect(warning).toBeHidden();
});

test("yardım ızgara modunda da kullanılabilir", async ({ page }) => {
    await withGrid(page, ["iphone-17"]);
    const toggle = page.getByRole("button", {
        name: "Site açılmıyor ya da mobilde görünmüyor mu?",
    });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("#help-panel")).toBeVisible();
});

test("ızgara modunda WCAG 2.1 AA ihlali yok", async ({ page }) => {
    await withGrid(page, ["iphone-17", "galaxy-s24"]);
    await box(page, "iphone-17").locator(".box-handle").click();
    await expect(page.getByRole("menu")).toBeVisible();
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
