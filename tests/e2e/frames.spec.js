import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

const box = (page, id) =>
    page.locator(`#device-grid > li[data-grid-id="${id}"]`);
const status = (page) => page.locator("#app-status");

async function openPreview(page) {
    await page.locator("#url-input").fill("localhost:5174");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

// Kaydırma çubuğu açılmamalı: kasa alanı taşmaz
const overflow = (locator) =>
    locator.evaluate((element) => [
        element.scrollWidth - element.clientWidth,
        element.scrollHeight - element.clientHeight,
    ]);

test("tek cihazda gerçekçi çerçeve açılır, duyurulur ve hatırlanır (FR-3.13)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    const toggle = page.getByRole("button", {
        name: "iPhone 17 için gerçekçi çerçeve",
    });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const shell = page.locator("#frame-shell");
    await expect(shell).not.toHaveClass(/is-framed/);
    const plain = await page.locator("#frame-canvas").boundingBox();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(status(page)).toHaveText(
        "iPhone 17 gerçekçi çerçeveyle gösteriliyor.",
    );
    await expect(shell).toHaveAttribute("data-frame", "phone");
    await expect(page.locator("#frame-housing")).toHaveAttribute(
        "data-cutout",
        "island",
    );
    // Kasa da alana sığdırılır: ekran biraz küçülür, sayfa aynı boyutta
    const framed = await page.locator("#frame-canvas").boundingBox();
    expect(framed.height).toBeLessThan(plain.height);
    await expect(page.locator("#frame-width")).toHaveValue("402");
    expect(await overflow(page.locator("#frame-viewport"))).toEqual([0, 0]);

    // Döndürülünce kamera yana geçer
    await page
        .getByRole("button", { name: "iPhone 17 cihazını yataya çevir" })
        .click();
    await expect(shell).toHaveClass(/is-rotated/);
    expect(await overflow(page.locator("#frame-viewport"))).toEqual([0, 0]);

    await page.reload();
    await openPreview(page);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(status(page)).toHaveText(
        "iPhone 17 sade çerçeveyle gösteriliyor.",
    );
    await expect(shell).not.toHaveClass(/is-framed/);
});

test("ızgarada her kutunun kendi düğmesi; seçim tek görünümle ortak (FR-3.13)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await page.evaluate(() =>
        localStorage.setItem(
            "rc-grid",
            JSON.stringify({
                ids: ["iphone-17", "apple-watch-44-mm", "macbook-pro-14"],
                mode: "grid",
                size: "medium",
            }),
        ),
    );
    await page.reload();
    await openPreview(page);
    const watch = box(page, "apple-watch-44-mm");
    const toggle = watch.getByRole("button", {
        name: "Apple Watch (44 mm) için gerçekçi çerçeve",
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(watch.locator(".device-shell")).toHaveAttribute(
        "data-frame",
        "watch",
    );
    // Yalnızca o kutu
    await expect(
        box(page, "iphone-17").locator(".device-shell"),
    ).not.toHaveClass(/is-framed/);
    await box(page, "macbook-pro-14")
        .getByRole("button", { name: "MacBook Pro 14 için gerçekçi çerçeve" })
        .click();
    for (const id of ["apple-watch-44-mm", "macbook-pro-14"])
        expect(await overflow(box(page, id).locator(".box-viewport"))).toEqual([
            0, 0,
        ]);

    // Tek görünümde aynı cihaz çerçeveli
    await page.getByRole("button", { name: "Tek cihaz" }).click();
    await page.getByRole("tab", { name: "Saat" }).click();
    await page
        .locator('.device-button[data-device-id="apple-watch-44-mm"]')
        .first()
        .click();
    await expect(
        page.getByRole("button", {
            name: "Apple Watch (44 mm) için gerçekçi çerçeve",
        }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#frame-shell")).toHaveAttribute(
        "data-frame",
        "watch",
    );
});

test("genel boyutlarda ve özel boyutlarda çerçeve düğmesi yok (FR-3.13)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    // Cihazlar aramayla seçilir; listede gruplar kapalı olabilir
    const choose = async (query, id) => {
        await page.getByLabel("Cihaz ara").fill(query);
        await page
            .locator(`.device-button[data-device-id="${id}"]`)
            .first()
            .click();
    };
    await choose("1920", "1920-x-1080");
    await expect(page.locator("#frame-realistic")).toBeHidden();
    await choose("Küçük telefon", "small-phone");
    await expect(page.locator("#frame-realistic")).toBeHidden();
    await choose("MacBook Pro 14", "macbook-pro-14");
    await expect(page.locator("#frame-realistic")).toBeVisible();
});

test("çerçeve düğmesi erişilebilirlik denetiminden geçer (NFR-5.1)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await openPreview(page);
    await page
        .getByRole("button", { name: "iPhone 17 için gerçekçi çerçeve" })
        .click();
    const results = await new AxeBuilder({ page })
        .include("#device-frame")
        .exclude("#preview-iframe")
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
