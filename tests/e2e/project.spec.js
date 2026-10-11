import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const APP_URL = "http://localhost:5173/";
test.use({ locale: "tr-TR" });

const PROJECT = Buffer.from(
    zipSync({
        "site/index.html": strToU8(
            '<!doctype html><html><head><title>Ana</title></head><body><h1>Ana sayfa</h1><a href="/hakkinda.html">Hakkında</a><button id="spa">SPA</button><script>document.getElementById("spa").onclick=()=>history.pushState({}, "", "/urunler/42")</script></body></html>',
        ),
        "site/hakkinda.html": strToU8(
            "<!doctype html><title>Hakkında</title><h1>Hakkında sayfası</h1>",
        ),
        "site/css/stil.css": strToU8("body{}"),
    }),
);

async function uploadProject(page) {
    await page.goto(APP_URL);
    await page.getByRole("button", { name: "Yükle" }).click();
    await page.locator("#file-input").setInputFiles({
        name: "site.zip",
        mimeType: "application/zip",
        buffer: PROJECT,
    });
    await expect(page.locator("#upload-dialog")).not.toBeVisible();
}

const preview = (page) => page.frameLocator("#preview-iframe");
const pathField = (page) => page.getByLabel("Proje içindeki sayfa");

test("yüklü proje etiketi ve yol alanı gösterilir", async ({ page }) => {
    await uploadProject(page);
    await expect(page.locator("#project-chip")).toBeVisible();
    await expect(page.locator("#project-name")).toHaveText(
        "site.zip · 3 dosya",
    );
    await expect(pathField(page)).toHaveValue("/index.html");
    await expect(
        page.getByRole("button", { name: "Projeyi kapat" }),
    ).toBeVisible();
});

test("önizlemede bağlantıya tıklanınca yol güncellenir (R-40)", async ({
    page,
}) => {
    await uploadProject(page);
    await preview(page).getByRole("link", { name: "Hakkında" }).click();
    await expect(preview(page).locator("h1")).toHaveText("Hakkında sayfası");
    await expect(pathField(page)).toHaveValue("/hakkinda.html");
});

test("tek sayfalık uygulama adres değiştirince yol güncellenir", async ({
    page,
}) => {
    await uploadProject(page);
    await preview(page).getByRole("button", { name: "SPA" }).click();
    await expect(pathField(page)).toHaveValue("/urunler/42");
});

test("yol yazılıp Aç'a basılınca o sayfa açılır", async ({ page }) => {
    await uploadProject(page);
    await pathField(page).fill("hakkinda.html");
    await page.getByRole("button", { name: "Aç", exact: true }).click();
    await expect(preview(page).locator("h1")).toHaveText("Hakkında sayfası");
    await expect(pathField(page)).toHaveValue("/hakkinda.html");
});

test("yardımcı betik sayfaya görünür bir şey eklemez (R-44)", async ({
    page,
}) => {
    await uploadProject(page);
    const body = await preview(page)
        .locator("body")
        .evaluate((element) =>
            Array.from(element.children, (child) => child.tagName),
        );
    expect(body).toEqual(["H1", "A", "BUTTON", "SCRIPT"]);
});

test("proje kapatılınca boş duruma ve URL alanına dönülür", async ({
    page,
}) => {
    await uploadProject(page);
    await page.getByRole("button", { name: "Projeyi kapat" }).click();
    await expect(page.locator("#project-chip")).toBeHidden();
    await expect(page.locator("#empty-state")).toBeVisible();
    const urlField = page.getByLabel("Test edilecek sitenin adresi");
    await expect(urlField).toHaveValue("");
    await expect(urlField).toBeFocused();
});

test.describe("dar ekran", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("proje etiketi kendi satırında, yol alanı altında", async ({
        page,
    }) => {
        await uploadProject(page);
        const chip = await page.locator("#project-chip").boundingBox();
        const field = await pathField(page).boundingBox();
        const open = await page
            .getByRole("button", { name: "Aç", exact: true })
            .boundingBox();
        const upload = await page
            .getByRole("button", { name: "Yükle" })
            .boundingBox();
        expect(chip.y + chip.height).toBeLessThanOrEqual(field.y);
        expect(chip.width).toBeGreaterThan(330);
        expect(Math.abs(field.y - open.y)).toBeLessThan(4);
        expect(Math.abs(open.y - upload.y)).toBeLessThan(4);
        // Proje adı kesilmeden sığıyor
        const truncated = await page
            .locator("#project-name")
            .evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(truncated).toBe(false);
        const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
        );
        expect(scrollWidth).toBe(375);
    });
});
