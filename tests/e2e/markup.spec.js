import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

// Beyaz sayfa: işaretlerin renkleri ölçülebilir
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

async function openShot(page) {
    await page
        .getByRole("button", { name: "iPhone 17 ekran görüntüsünü al" })
        .click();
    await expect(page.locator("#shot-image")).toBeVisible();
}

// Görsel üzerinde oransal konumlar arasında sürükler
async function drag(page, from, to) {
    const box = await page.locator("#mark-layer").boundingBox();
    await page.mouse.move(
        box.x + box.width * from[0],
        box.y + box.height * from[1],
    );
    await page.mouse.down();
    await page.mouse.move(
        box.x + box.width * to[0],
        box.y + box.height * to[1],
        {
            steps: 6,
        },
    );
    await page.mouse.up();
}

// Bayt dizisindeki PNG'de bir noktanın çevresinde (dikeyde ±20 px) en
// kırmızı piksel; tarayıcılar fare konumunu yuvarladığı için çizgi birkaç
// piksel kayabilir
const pixelOf = (page, bytes, fx, fy) =>
    page.evaluate(
        async ({ data, fx, fy }) => {
            const blob = new Blob([new Uint8Array(data)], {
                type: "image/png",
            });
            const bitmap = await createImageBitmap(blob);
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext("2d");
            context.drawImage(bitmap, 0, 0);
            const x = Math.round(bitmap.width * fx);
            const y = Math.round(bitmap.height * fy);
            let best = null;
            for (let dy = -20; dy <= 20; dy += 1) {
                const [r, g, b] = context.getImageData(x, y + dy, 1, 1).data;
                if (!best || r - g > best[0] - best[1]) best = [r, g, b];
            }
            return best;
        },
        { data: [...bytes], fx, fy },
    );

test("ok çizilir ve indirilen görsele girer (FR-5.3)", async ({ page }) => {
    await upload(page);
    await openShot(page);
    const tools = page.getByRole("group", { name: "İşaretleme araçları" });
    await expect(tools).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Ok", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Kırmızı" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    const undo = page.getByRole("button", { name: "Geri al", exact: true });
    await expect(undo).toBeDisabled();
    // Yatay ok: y = 0,5 boyunca
    await drag(page, [0.2, 0.5], [0.8, 0.5]);
    await expect(undo).toBeEnabled();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const bytes = readFileSync(await (await download).path());
    const [r, g, b] = await pixelOf(page, bytes, 0.5, 0.5);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeLessThan(90);
    expect(b).toBeLessThan(120);

    // Geri al: işaret kalkar
    await undo.click();
    await expect(undo).toBeDisabled();
    const clean = page.waitForEvent("download");
    await page.getByRole("button", { name: "İndir" }).click();
    const cleanBytes = readFileSync(await (await clean).path());
    expect(await pixelOf(page, cleanBytes, 0.5, 0.5)).toEqual([255, 255, 255]);
});

test("daire seçilen renkle, yazı Enter ile eklenir; Esc yalnızca yazıdan vazgeçer", async ({
    page,
}) => {
    await upload(page);
    await openShot(page);
    await page.getByRole("button", { name: "Daire", exact: true }).click();
    await page.getByRole("button", { name: "Mavi" }).click();
    await expect(page.getByRole("button", { name: "Mavi" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await drag(page, [0.2, 0.2], [0.8, 0.4]);

    await page.getByRole("button", { name: "Yazı", exact: true }).click();
    const layer = await page.locator("#mark-layer").boundingBox();
    await page.mouse.click(layer.x + 20, layer.y + layer.height * 0.7);
    const input = page.getByRole("textbox", { name: "İşaret yazısı" });
    await expect(input).toBeFocused();
    await page.keyboard.type("Vazgeç");
    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
    // Pencere açık kalır
    await expect(page.locator("#shot-dialog")).toBeVisible();
    await page.mouse.click(layer.x + 20, layer.y + layer.height * 0.7);
    await page.keyboard.type("Boşluk fazla");
    await page.keyboard.press("Enter");
    await expect(input).toBeHidden();

    // İki işaret: Temizle hepsini kaldırır
    await page.getByRole("button", { name: "Temizle", exact: true }).click();
    await expect(
        page.getByRole("button", { name: "Geri al", exact: true }),
    ).toBeDisabled();
});

test("rapora eklenir, panelde görünür, yenilemede kalır ve kaldırılır (FR-5.1)", async ({
    page,
}) => {
    await upload(page);
    await openShot(page);
    await drag(page, [0.2, 0.5], [0.8, 0.5]);
    const add = page.getByRole("button", { name: "Rapora ekle" });
    await add.click();
    await expect(page.locator("#shot-message")).toHaveText("Rapora eklendi.");
    await expect(page.locator("#app-status")).toHaveText("Rapora eklendi.");
    await expect(add).toBeDisabled();
    await page.getByRole("button", { name: "Kapat", exact: true }).click();

    await page.getByRole("button", { name: "Notlar", exact: true }).click();
    const thumbs = page.locator('[data-shots-for="iphone-17"] img');
    await expect(thumbs).toHaveCount(1);
    await expect(thumbs.first()).toHaveAccessibleName(
        "iPhone 17 ekran görüntüsü (1206 × 2622)",
    );

    // Sayfa yenilenip aynı proje yüklenince görüntü geri gelir (IndexedDB)
    await page.reload();
    await upload(page);
    await page.getByRole("button", { name: "Notlar", exact: true }).click();
    await expect(thumbs).toHaveCount(1);

    // Temizle ve geri al görüntüleri de kapsar
    await page.getByRole("button", { name: "Notları temizle" }).click();
    await expect(thumbs).toHaveCount(0);
    await page.getByRole("button", { name: "Geri al", exact: true }).click();
    await expect(thumbs).toHaveCount(1);

    await page
        .getByRole("button", { name: "Görüntüyü rapordan çıkar" })
        .click();
    await expect(thumbs).toHaveCount(0);
});

test("toplu: her cihaz kendi notuna, ızgara görseli genel görüntülere eklenir", async ({
    page,
}) => {
    await upload(page, {
        ids: ["iphone-17", "galaxy-s24"],
        mode: "grid",
        size: "medium",
    });
    await page.getByRole("button", { name: "Tümünün ekran görüntüsü" }).click();
    await expect(page.locator("#shot-parts img")).toHaveCount(2);
    // Birden çok görselde işaretleme yok
    await expect(page.locator("#mark-tools")).toBeHidden();
    await page.getByRole("button", { name: "Rapora ekle" }).click();
    await expect(page.locator("#shot-message")).toHaveText("Rapora eklendi.");
    await page.getByRole("button", { name: "Tek görsel (ızgara)" }).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await expect(page.locator("#mark-tools")).toBeVisible();
    await page.getByRole("button", { name: "Rapora ekle" }).click();
    await expect(page.locator("#shot-message")).toHaveText("Rapora eklendi.");
    await page.getByRole("button", { name: "Kapat", exact: true }).click();

    await page.getByRole("button", { name: "Notlar", exact: true }).click();
    await expect(page.locator('[data-shots-for="iphone-17"] img')).toHaveCount(
        1,
    );
    await expect(page.locator('[data-shots-for="galaxy-s24"] img')).toHaveCount(
        1,
    );
    await expect(page.locator("#notes-general")).toBeVisible();
    await expect(page.locator("#notes-general-shots img")).toHaveCount(1);
});

test("işaretleme ve rapordaki görüntülerde WCAG 2.1 AA ihlali yok", async ({
    page,
}) => {
    await upload(page);
    await openShot(page);
    const dialog = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(dialog.violations).toEqual([]);
    await page.getByRole("button", { name: "Rapora ekle" }).click();
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
    await page.getByRole("button", { name: "Notlar", exact: true }).click();
    await expect(page.locator(".notes-shots img")).toHaveCount(1);
    const panel = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
    expect(panel.violations).toEqual([]);
});
