import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const TARGET = "localhost:5174";

test.use({ locale: "tr-TR" });

async function openTarget(page) {
    await page.goto(APP_URL);
    await page.getByLabel("Test edilecek sitenin adresi").fill(TARGET);
    await page.getByRole("button", { name: "Aç", exact: true }).click();
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
    await page.getByRole("button", { name: "Aç", exact: true }).click();
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

    await page.locator('[data-device-id="full-hd"]').click();
    await expect(page.locator("#frame-size")).toHaveText("1920 × 1080");
    await expect(page.locator("#browser-bars-option")).toBeHidden();

    await page.locator('[data-device-id="galaxy-s24"]').first().click();
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

    test("yardım açılınca panel görünür alana gelir", async ({ page }) => {
        await openTarget(page);
        await page.locator("#help-toggle").click();
        await expect(page.locator("#help-panel")).toBeInViewport({
            ratio: 1,
        });
        // Yumuşak kaydırma bitince panel alttaki cihaz panelinin arkasında kalmamalı
        await expect
            .poll(async () => {
                const help = await page.locator("#help-panel").boundingBox();
                const sheet = await page.locator("#sidebar").boundingBox();
                return sheet.y - (help.y + help.height);
            })
            .toBeGreaterThanOrEqual(0);
        // Çerçeve tam boyuta büyümemeli, alana sığacak şekilde küçük kalmalı
        const frame = await page.locator("#frame-viewport").boundingBox();
        expect(frame.height).toBeLessThan(812);
    });

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
        // Panel açılınca odak ilk öğeye, arama kutusuna geçer
        await expect(page.getByLabel("Cihaz ara")).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toBeFocused();
    });
});

test("'Site açılmıyor mu?' yardımı açılıp kapanır (FR-2.2)", async ({
    page,
}) => {
    await openTarget(page);
    const toggle = page.getByRole("button", {
        name: "Site açılmıyor ya da mobilde görünmüyor mu?",
    });
    const panel = page.locator("#help-panel");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toContainText("bağlanmayı reddetti");
    await expect(panel).toContainText("tarayıcının kimliğine göre");
    await expect(panel).toContainText("Windows'ta F12");

    // Yardım paneli görünür alana kaydırılır; sayfa pencereden uzamaz,
    // gerekirse önizleme alanı kendi içinde kayar
    await expect(panel).toBeInViewport();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight,
        ),
    ).toBe(0);

    await toggle.click();
    await expect(panel).toBeHidden();
});

test("site seçili cihaz boyutunda yeni pencerede açılır (FR-2.3)", async ({
    page,
    context,
}) => {
    await openTarget(page);
    await page
        .getByRole("button", {
            name: "Site açılmıyor ya da mobilde görünmüyor mu?",
        })
        .click();
    const [popup] = await Promise.all([
        context.waitForEvent("page"),
        page
            .getByRole("button", { name: "Bu boyutta yeni pencerede aç" })
            .click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe("http://localhost:5174/");
    // Genişlik cihazla aynı olmalı; yükseklik ekrana sığacak kadar kısalabilir
    const size = await popup.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        opener: window.opener,
    }));
    expect(size.width).toBe(402);
    expect(size.height).toBeLessThanOrEqual(874);
    expect(size.opener).toBeNull();
});

test("favicon yükleniyor", async ({ page, request }) => {
    await page.goto(APP_URL);
    for (const href of [
        "/favicon.svg",
        "/favicon-32.png",
        "/apple-touch-icon.png",
    ]) {
        await expect(page.locator(`link[href="${href}"]`)).toHaveCount(1);
        const response = await request.get(`http://localhost:5173${href}`);
        expect(response.ok()).toBe(true);
    }
});

test("geniş ekranda cihaz menüsü kendi içinde kayar, sayfa büyümez", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(APP_URL);
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
    const sizes = () =>
        page.evaluate(() => {
            const sidebar = document.getElementById("sidebar");
            return {
                page: document.documentElement.scrollHeight,
                window: window.innerHeight,
                stage: document.getElementById("stage").offsetHeight,
                sidebar: sidebar.clientHeight,
                list: sidebar.scrollHeight,
                scrolled: sidebar.scrollTop,
            };
        });
    const before = await sizes();
    // Telefon listesi pencereden uzun, ama sayfa pencere yüksekliğinde kalır
    expect(before.list).toBeGreaterThan(before.sidebar);
    expect(before.page).toBe(before.window);
    expect(before.stage).toBeLessThan(before.window);

    await page.locator("#sidebar").hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(async () => (await sizes()).scrolled).toBeGreaterThan(0);
    // Önizleme alanı menü kaydırılınca yerinde kalır
    await expect(page.locator("#device-frame")).toBeInViewport();
});
