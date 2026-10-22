import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { strToU8, unzipSync, zipSync } from "fflate";

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

// Beyaz sayfalı proje: ekran görüntüsü yardımcı betikle alınır
const PROJECT = Buffer.from(
    zipSync({
        "index.html": strToU8(
            '<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0;background:#fff}</style><p>Kafe</p>',
        ),
    }),
);

async function upload(page, grid) {
    await page.goto(APP_URL);
    if (grid) {
        await page.evaluate(
            (value) => localStorage.setItem("rc-grid", value),
            JSON.stringify(grid),
        );
        await page.reload();
    }
    await page.getByRole("button", { name: "Yükle" }).click();
    await page.locator("#file-input").setInputFiles({
        name: "kafe.zip",
        mimeType: "application/zip",
        buffer: PROJECT,
    });
    await expect(page.locator("#upload-dialog")).not.toBeVisible();
}

const naturalSize = (page) =>
    page
        .locator("#shot-image")
        .evaluate((img) => [img.naturalWidth, img.naturalHeight]);

// Görselin bir noktasının saydamlığı (köşe kasanın dışında kalır)
const alphaAt = (page, x, y) =>
    page.locator("#shot-image").evaluate(
        (img, [px, py]) => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(img, 0, 0);
            return context.getImageData(px, py, 1, 1).data[3];
        },
        [x, y],
    );

test("Çerçeveyle: ekran görüntüsüne kasa çizilir, seçilebilir (FR-3.13)", async ({
    page,
}, testInfo) => {
    await upload(page, {
        ids: [],
        mode: "single",
        size: "medium",
        framed: ["iphone-17"],
    });
    await page
        .getByRole("button", { name: "iPhone 17 ekran görüntüsünü al" })
        .click();
    const option = page.getByRole("checkbox", { name: "Çerçeveyle" });
    // Çerçeve ekranda açık olduğu için işaretli gelir
    await expect(option).toBeChecked();
    await expect(page.locator("#shot-image")).toBeVisible();
    // 402 × 874 ekran + 12 piksel kasa, 3x yoğunluk
    await expect.poll(() => naturalSize(page)).toEqual([426 * 3, 898 * 3]);
    expect(await alphaAt(page, 2, 2)).toBe(0);
    if (testInfo.project.name === "chromium")
        writeFileSync(
            testInfo.outputPath("framed.png"),
            Buffer.from(
                await page.locator("#shot-image").evaluate((img) =>
                    fetch(img.src)
                        .then((r) => r.arrayBuffer())
                        .then((b) => [...new Uint8Array(b)]),
                ),
            ),
        );

    // İndirilen dosya da çerçeveli
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const bytes = readFileSync(await (await download).path());
    expect(bytes.readUInt32BE(16)).toBe(426 * 3);

    await option.uncheck();
    await expect.poll(() => naturalSize(page)).toEqual([402 * 3, 874 * 3]);

    // Tam sayfada seçenek yok
    await page.getByRole("button", { name: "Tam sayfa" }).click();
    await expect(option).toBeHidden();
    await page.getByRole("button", { name: "Görünen alan" }).click();
    await expect(option).toBeVisible();
    await expect(option).not.toBeChecked();
});

test("Çerçeveyle: çerçeve kapalıyken işaretsiz; çerçevesiz cihazda yok (FR-3.13)", async ({
    page,
}) => {
    await upload(page);
    await page
        .getByRole("button", { name: "iPhone 17 ekran görüntüsünü al" })
        .click();
    const option = page.getByRole("checkbox", { name: "Çerçeveyle" });
    await expect(option).toBeVisible();
    await expect(option).not.toBeChecked();
    await page.getByRole("button", { name: "Kapat", exact: true }).click();

    await page.getByLabel("Cihaz ara").fill("Küçük telefon");
    await page
        .locator('.device-button[data-device-id="small-phone"]')
        .first()
        .click();
    await page
        .getByRole("button", { name: "Küçük telefon ekran görüntüsünü al" })
        .click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await expect(option).toBeHidden();
});

test("Çerçeveyle: toplu görüntüde çerçevesi olan her cihaza (FR-3.13, FR-4.4)", async ({
    page,
}) => {
    await upload(page, {
        ids: ["iphone-17", "small-phone"],
        mode: "grid",
        size: "medium",
        framed: ["iphone-17"],
    });
    await page.getByRole("button", { name: "Tümünün ekran görüntüsü" }).click();
    await expect(page.locator("#shot-parts img")).toHaveCount(2);
    await expect(
        page.getByRole("checkbox", { name: "Çerçeveyle" }),
    ).toBeChecked();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const files = unzipSync(readFileSync(await (await download).path()));
    const width = (name) => Buffer.from(files[name]).readUInt32BE(16);
    const names = Object.keys(files);
    const phone = names.find((name) => name.startsWith("iphone-17"));
    const generic = names.find((name) => name.startsWith("kucuk-telefon"));
    // iPhone kasalı, genel boyut olduğu gibi
    expect(width(phone)).toBe(426 * 3);
    expect(width(generic)).toBe(360);

    // Tek görsel (ızgara) de aynı seçenekle
    await page.getByRole("button", { name: "Tek görsel (ızgara)" }).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await expect(
        page.getByRole("checkbox", { name: "Çerçeveyle" }),
    ).toBeVisible();
});
