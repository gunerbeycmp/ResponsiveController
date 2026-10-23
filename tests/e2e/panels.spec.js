import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

async function openPreview(page) {
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

test("Görünüm paneli sağda; paneller daraltılır, şerit kalır, durum hatırlanır (Aşama 6 revizyonu)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    const view = page.getByRole("complementary", { name: "Görünüm" });
    await expect(view).toBeVisible();
    const sidebar = page.locator("#sidebar");
    const stage = page.locator("#stage");
    const before = (await stage.boundingBox()).width;

    const collapseDevices = page.getByRole("button", {
        name: "Cihazlar panelini kapat",
    });
    await expect(collapseDevices).toHaveAttribute("aria-expanded", "true");
    await collapseDevices.click();
    const expandDevices = page.getByRole("button", {
        name: "Cihazlar panelini aç",
    });
    // Odak şeritteki açma düğmesine geçer
    await expect(expandDevices).toBeFocused();
    await expect(expandDevices).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#device-search")).toBeHidden();
    await expect(sidebar.locator(".rail-title")).toHaveText("Cihazlar");
    // Genişlik kayarak daralır
    await expect
        .poll(async () => (await sidebar.boundingBox()).width)
        .toBeLessThan(50);

    await page.getByRole("button", { name: "Görünüm panelini kapat" }).click();
    await expect(
        page.getByRole("button", { name: "Görünüm panelini aç" }),
    ).toBeFocused();
    // Önizleme alanı genişler
    await expect
        .poll(async () => (await stage.boundingBox()).width)
        .toBeGreaterThan(before + 400);

    await page.reload();
    await expect(page.locator("#device-search")).toBeHidden();
    await expandDevices.click();
    await expect(collapseDevices).toBeFocused();
    await expect(page.locator("#device-search")).toBeVisible();
    await page.getByRole("button", { name: "Görünüm panelini aç" }).click();
    await expect(view.locator(".sidebar-title")).toBeVisible();

    const results = await new AxeBuilder({ page })
        .include("#sidebar")
        .include("#view-panel")
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});

test("Notlar açılınca Görünüm panelinin yerini alır (Aşama 6 revizyonu)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    const view = page.locator("#view-panel");
    await page.getByRole("button", { name: "Notlar", exact: true }).click();
    await expect(page.locator("#notes-panel")).toBeVisible();
    await expect(view).toBeHidden();
    await page.getByRole("button", { name: "Notları kapat" }).click();
    await expect(view).toBeVisible();
});

test("Tek cihaz / Izgara Görünüm panelinde; zemin seçilene kayar (Aşama 6 revizyonu)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    const view = page.locator("#view-panel");
    const single = view.getByRole("button", { name: "Tek cihaz" });
    const grid = view.getByRole("button", { name: "Izgara" });
    // Site açılmadan pasif; önizlemenin araç çubuğunda yok
    await expect(grid).toBeDisabled();
    await openPreview(page);
    await expect(
        page.locator("#view-toolbar").getByRole("button", { name: "Izgara" }),
    ).toHaveCount(0);
    await expect(single).toHaveAttribute("aria-pressed", "true");

    await grid.click();
    await expect(grid).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#grid-section")).toBeVisible();
    const thumb = page.locator("#view-switch .view-switch-thumb");
    // Kayma bitince zemin Izgara'nın tam altında
    await expect
        .poll(async () => {
            const [a, b] = [
                await thumb.boundingBox(),
                await grid.boundingBox(),
            ];
            return Math.round(Math.abs(a.x - b.x));
        })
        .toBeLessThanOrEqual(1);
    expect(
        await thumb.evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0.25s");

    // Hareket azaltmada animasyon yok
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
        await thumb.evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");
});

test("kutu boyutu panelde, yalnızca ızgarada; zemin kayar (v0.6.8)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    const view = page.locator("#view-panel");
    const sizes = view.getByRole("group", { name: "Kutu boyutu" });
    await expect(sizes).toBeHidden();
    await view.getByRole("button", { name: "Izgara" }).click();
    await expect(sizes).toBeVisible();
    const large = sizes.getByRole("button", { name: "Büyük" });
    await large.click();
    await expect(large).toHaveAttribute("aria-pressed", "true");
    const thumb = sizes.locator(".view-switch-thumb");
    await expect
        .poll(async () => {
            const [a, b] = [
                await thumb.boundingBox(),
                await large.boundingBox(),
            ];
            return Math.round(
                Math.abs(a.x - b.x) + Math.abs(a.width - b.width),
            );
        })
        .toBeLessThanOrEqual(1);
    // Önizlemenin araç çubuğunda yok
    await expect(
        page.locator("#view-toolbar").getByRole("button", { name: "Büyük" }),
    ).toHaveCount(0);
});

test("panel kayarak açılıp kapanır; bu sırada cihaz yeniden sığmaz (v0.6.8)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    const sidebar = page.locator("#sidebar");
    expect(
        await sidebar.evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0.25s");
    const canvas = page.locator("#frame-canvas");
    const before = (await canvas.boundingBox()).width;
    // Kapanma başladıktan hemen sonra cihaz aynı boyutta
    const during = await page.evaluate(async () => {
        document.getElementById("devices-collapse").click();
        await new Promise((resolve) => setTimeout(resolve, 80));
        return [
            document.getElementById("sidebar").getBoundingClientRect().width,
            document.getElementById("frame-canvas").getBoundingClientRect()
                .width,
        ];
    });
    expect(during[0]).toBeGreaterThan(40);
    expect(during[0]).toBeLessThan(280);
    expect(Math.round(during[1])).toBe(Math.round(before));

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
        await sidebar.evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");
});

test.describe("telefon", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("iki alt sayfa; aynı anda yalnızca biri açık (Aşama 6 revizyonu)", async ({
        page,
    }) => {
        await page.goto(APP_URL);
        const devices = page.getByRole("button", { name: "Cihazları göster" });
        const view = page.getByRole("button", { name: "Görünümü göster" });
        await expect(devices).toBeVisible();
        await expect(view).toBeVisible();
        // Daraltma düğmeleri telefonda yok
        await expect(page.locator("#devices-collapse")).toBeHidden();

        await view.click();
        const hideView = page.getByRole("button", { name: "Görünümü gizle" });
        await expect(hideView).toHaveAttribute("aria-expanded", "true");
        await expect(devices).toBeHidden();
        await hideView.click();
        await devices.click();
        await expect(
            page.getByRole("button", { name: "Cihazları gizle" }),
        ).toHaveAttribute("aria-expanded", "true");
        await expect(view).toBeHidden();
        await expect(page.locator("#device-search")).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
    });
});
