import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const VIEWPORT = '<meta name="viewport" content="width=device-width">';

const zip = (files) =>
    Buffer.from(
        zipSync(
            Object.fromEntries(
                Object.entries(files).map(([name, text]) => [
                    name,
                    strToU8(text),
                ]),
            ),
        ),
    );

async function upload(page, name, buffer) {
    await page.goto(APP_URL);
    await page.locator("#upload-button").click();
    await page.locator("#file-input").setInputFiles({
        name,
        mimeType: "application/zip",
        buffer,
    });
}

const expectNoViolations = async (page) => {
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .exclude("#preview-iframe")
        .analyze();
    expect(results.violations).toEqual([]);
};

test.describe("proje uyarıları (FR-1.7 - FR-1.10)", () => {
    test.use({ locale: "tr-TR" });

    test("üç uyarı listelenir, açılıp kapanır", async ({ page }) => {
        await upload(
            page,
            "sorunlu.zip",
            zip({
                "index.html":
                    '<!doctype html><link rel="stylesheet" href="css/yok.css"><img src="logo.png" alt=""><h1>Sorunlu</h1>',
                "logo.png": "x",
                "api/kayit.php": "<?php ?>",
            }),
        );
        const toggle = page.locator("#warnings-toggle");
        await expect(toggle).toBeVisible();
        await expect(toggle).toContainText("3 uyarı");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator("#warnings-panel")).toBeHidden();

        await toggle.click();
        const items = page.locator("#warnings-panel li");
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toContainText("viewport etiketi yok");
        await expect(items.nth(1)).toContainText("/api/kayit.php");
        await expect(items.nth(2)).toContainText(
            "Bulunamayan dosyalar: /css/yok.css",
        );
        await expectNoViolations(page);

        // Liste açıkken önizleme alana sığmaya devam eder
        const stage = await page.locator("#stage").boundingBox();
        const help = await page.locator("#frame-help").boundingBox();
        expect(help.y + help.height).toBeLessThanOrEqual(
            stage.y + stage.height + 1,
        );

        await toggle.click();
        await expect(page.locator("#warnings-panel")).toBeHidden();
    });

    test("sorunsuz projede uyarı düğmesi görünmez", async ({ page }) => {
        await upload(
            page,
            "temiz.zip",
            zip({ "index.html": `<!doctype html>${VIEWPORT}<h1>Temiz</h1>` }),
        );
        await expect(
            page.frameLocator("#preview-iframe").locator("h1"),
        ).toHaveText("Temiz");
        await expect(page.locator("#warnings-toggle")).toBeHidden();
    });

    test("proje kapatılınca uyarılar da kalkar", async ({ page }) => {
        await upload(page, "a.zip", zip({ "index.html": "<h1>A</h1>" }));
        await expect(page.locator("#warnings-toggle")).toBeVisible();
        await page.getByRole("button", { name: "Projeyi kapat" }).click();
        await expect(page.locator("#warnings-toggle")).toBeHidden();
    });
});

test.describe("tek uyarı (İngilizce)", () => {
    test.use({ locale: "en-US" });

    test("tekil biçim kullanılır", async ({ page }) => {
        await upload(
            page,
            "one.zip",
            zip({
                "index.html": `<!doctype html>${VIEWPORT}<img src="x.png">`,
            }),
        );
        await expect(page.locator("#warnings-toggle")).toContainText(
            "1 warning",
        );
        await expect(page.locator("#warnings-toggle")).not.toContainText(
            "warnings",
        );
    });
});

test.describe("kaynak kod uyarısı (FR-1.9)", () => {
    test.use({ locale: "tr-TR" });

    const SOURCE = zip({
        "index.html": `<!doctype html>${VIEWPORT}<h1>Kaynak</h1>`,
        "package.json": "{}",
        "src/main.js": "",
    });

    test("Vazgeç ile pencere kapanır, proje açılmaz", async ({ page }) => {
        await upload(page, "kaynak.zip", SOURCE);
        const warning = page.locator("#source-warning");
        await expect(warning).toBeVisible();
        await expect(warning).toContainText("npm run build");
        await expect(
            page.getByRole("button", { name: "Yine de aç" }),
        ).toBeFocused();
        await expectNoViolations(page);

        await page.locator("#source-cancel").click();
        await expect(page.locator("#upload-dialog")).not.toBeVisible();
        await expect(page.locator("#empty-state")).toBeVisible();
        await expect(page.locator("#project-chip")).toBeHidden();
    });

    test("Yine de aç ile proje açılır", async ({ page }) => {
        await upload(page, "kaynak.zip", SOURCE);
        await page.getByRole("button", { name: "Yine de aç" }).click();
        await expect(page.locator("#upload-dialog")).not.toBeVisible();
        await expect(
            page.frameLocator("#preview-iframe").locator("h1"),
        ).toHaveText("Kaynak");
    });
});

test("'Site açılmıyor' yardımından yükleme penceresi açılır (FR-2.3)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await page.locator("#url-input").fill("localhost:5174");
    await page.locator("#url-form button[type=submit]").click();
    await page.locator("#help-toggle").click();
    await page.locator("#help-upload").click();
    await expect(page.locator("#upload-dialog")).toBeVisible();
});
