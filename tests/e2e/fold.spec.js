import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pickDevice } from "./menu.js";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

const status = (page) => page.locator("#app-status");
const boxIds = (page) =>
    page
        .locator("#device-grid > li:not([hidden])")
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.gridId));
const box = (page, id) =>
    page.locator(`#device-grid > li[data-grid-id="${id}"]`);

async function openWith(page, deviceId, grid) {
    await page.goto(APP_URL);
    if (grid) {
        await page.evaluate(
            (value) => localStorage.setItem("rc-grid", value),
            JSON.stringify(grid),
        );
        await page.reload();
    }
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
    if (deviceId) await pickDevice(page, deviceId);
}

test("tek cihazda Katla / Aç iki hâl arasında geçer (FR-3.5)", async ({
    page,
}) => {
    await openWith(page);
    // Katlanabilir olmayan cihazda düğmeler görünmez
    await expect(page.locator("#frame-fold")).toBeHidden();
    await expect(page.locator("#frame-side-by-side")).toBeHidden();

    await pickDevice(page, "galaxy-z-fold-7-open");
    const fold = page.getByRole("button", {
        name: "Galaxy Z Fold 7 cihazını katla",
    });
    await expect(fold).toHaveText("Katla");
    await page
        .getByRole("button", {
            name: "Galaxy Z Fold 7 · Açık cihazını yataya çevir",
        })
        .click();
    await fold.click();
    await expect(page.locator("#frame-name")).toHaveText(
        "Galaxy Z Fold 7 · Katlı",
    );
    await expect(status(page)).toHaveText(
        "Galaxy Z Fold 7 · Katlı gösteriliyor.",
    );
    // Döndürme diğer hâle de taşınır: katlı hâl 360 × 840, yatayda 840 × 360
    await expect(page.locator("#frame-width")).toHaveValue("840");
    await expect(page.locator("#frame-height")).toHaveValue("360");
    const unfold = page.getByRole("button", {
        name: "Galaxy Z Fold 7 cihazını aç",
    });
    await expect(unfold).toHaveText("Aç");
    await expect(unfold).toBeFocused();
    await unfold.click();
    await expect(page.locator("#frame-name")).toHaveText(
        "Galaxy Z Fold 7 · Açık",
    );
});

test("Yan yana göster boş ızgarada iki hâli ekler ve ızgaraya geçer", async ({
    page,
}) => {
    await openWith(page, "galaxy-z-flip-7-open");
    await page.getByRole("button", { name: "Yan yana göster" }).click();
    await expect(
        page
            .locator("#view-switch")
            .getByRole("button", { name: "Izgara", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await boxIds(page)).toEqual([
        "galaxy-z-flip-7-folded",
        "galaxy-z-flip-7-open",
    ]);
    await expect(status(page)).toHaveText(
        "Galaxy Z Flip 7 katlı ve açık hâli ızgarada yan yana.",
    );
});

test("Yan yana göster mevcut ızgarayı korur, diğer hâli yanına ekler", async ({
    page,
}) => {
    await openWith(page, null, {
        ids: ["iphone-17", "galaxy-z-fold-7-open", "galaxy-s24"],
        mode: "single",
        size: "small",
    });
    await pickDevice(page, "galaxy-z-fold-7-open");
    await page.getByRole("button", { name: "Yan yana göster" }).click();
    expect(await boxIds(page)).toEqual([
        "iphone-17",
        "galaxy-z-fold-7-folded",
        "galaxy-z-fold-7-open",
        "galaxy-s24",
    ]);
});

test("ızgarada Katla / Aç kutunun yerini korur", async ({ page }) => {
    await openWith(page, null, {
        ids: ["iphone-17", "galaxy-z-fold-6-open", "galaxy-s24"],
        mode: "grid",
        size: "small",
    });
    // Katlanabilir olmayan kutuda düğme yok
    await expect(box(page, "iphone-17").locator(".box-fold")).toBeHidden();
    await box(page, "galaxy-z-fold-6-open")
        .getByRole("button", { name: "Galaxy Z Fold 6 cihazını katla" })
        .click();
    expect(await boxIds(page)).toEqual([
        "iphone-17",
        "galaxy-z-fold-6-folded",
        "galaxy-s24",
    ]);
    const unfold = box(page, "galaxy-z-fold-6-folded").getByRole("button", {
        name: "Galaxy Z Fold 6 cihazını aç",
    });
    await expect(unfold).toBeFocused();
    await expect(status(page)).toHaveText(
        "Galaxy Z Fold 6 · Katlı gösteriliyor.",
    );
    // Menüdeki ✓ işaretleri de güncellenir
    await expect(
        page
            .locator('#device-list [data-grid-toggle="galaxy-z-fold-6-folded"]')
            .first(),
    ).toHaveText("✓");
});

test("iki hâl yan yanayken Katla / Aç ikisini geri getirir", async ({
    page,
}) => {
    await openWith(page, null, {
        ids: ["iphone-17", "galaxy-z-fold-7-folded", "galaxy-z-fold-7-open"],
        mode: "grid",
        size: "small",
    });
    // Açık kutuda Katla: diğer hâl zaten ızgarada olduğu için tek kutu kalır
    await box(page, "galaxy-z-fold-7-open")
        .getByRole("button", { name: "Galaxy Z Fold 7 cihazını katla" })
        .click();
    expect(await boxIds(page)).toEqual(["iphone-17", "galaxy-z-fold-7-folded"]);
    const unfold = box(page, "galaxy-z-fold-7-folded").getByRole("button", {
        name: "Galaxy Z Fold 7 cihazını aç",
    });
    await expect(unfold).toBeFocused();
    // Kalan kutuda Aç: açık hâl eski yerine döner, ikisi yine yan yana
    await unfold.click();
    expect(await boxIds(page)).toEqual([
        "iphone-17",
        "galaxy-z-fold-7-folded",
        "galaxy-z-fold-7-open",
    ]);
    await expect(status(page)).toHaveText(
        "Galaxy Z Fold 7 katlı ve açık hâli ızgarada yan yana.",
    );
    await expect(unfold).toBeFocused();

    // Katlı kutuda Aç da aynı şekilde çalışır
    await unfold.click();
    expect(await boxIds(page)).toEqual(["iphone-17", "galaxy-z-fold-7-open"]);
    await box(page, "galaxy-z-fold-7-open")
        .getByRole("button", { name: "Galaxy Z Fold 7 cihazını katla" })
        .click();
    expect(await boxIds(page)).toEqual([
        "iphone-17",
        "galaxy-z-fold-7-folded",
        "galaxy-z-fold-7-open",
    ]);
});

test("katlanabilir cihazda WCAG 2.1 AA ihlali yok", async ({ page }) => {
    await openWith(page, "galaxy-z-fold-7-open");
    // Görünüm geçişinin kayan zemini ve yazı rengi yerine otursun
    await page.waitForFunction(() =>
        document
            .getAnimations()
            .every((animation) => animation.playState !== "running"),
    );
    const single = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(single.violations).toEqual([]);
    await page.getByRole("button", { name: "Yan yana göster" }).click();
    // Görünüm geçişinin kayan zemini ve yazı rengi yerine otursun
    await page.waitForFunction(() =>
        document
            .getAnimations()
            .every((animation) => animation.playState !== "running"),
    );
    const grid = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
    expect(grid.violations).toEqual([]);
});
