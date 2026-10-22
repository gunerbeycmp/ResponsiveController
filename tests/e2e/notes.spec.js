import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

async function openUrl(page, address = "localhost:5174") {
    await page.locator("#url-input").fill(address);
    await page.getByRole("button", { name: "Aç", exact: true }).click();
}

const notesButton = (page) =>
    page.getByRole("button", { name: "Notlar", exact: true });
const panel = (page) => page.locator("#notes-panel");

test("cihaz notu başlıktan yazılır, panelde görünür ve saklanır (FR-5.3)", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await expect(notesButton(page)).toBeHidden();
    await openUrl(page);
    const toggle = page.getByRole("button", { name: "iPhone 17 notu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    // Başlıktaki alan; panel açılınca aynı adlı ikinci alan olur
    const inline = page.locator("#device-note-text");
    await expect(inline).toHaveAccessibleName("iPhone 17 notu");
    await expect(inline).toBeFocused();
    await expect(inline).toHaveAttribute(
        "placeholder",
        "Bu cihazda gördüklerin…",
    );
    await page.keyboard.type("Menü çentiğin altında");
    await expect(toggle).toHaveClass(/has-note/);

    // Panelde aynı not; panelden düzenleme başlıktaki alana yansır
    await notesButton(page).click();
    await expect(notesButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("Genel not")).toBeFocused();
    const fromPanel = panel(page).getByRole("textbox", {
        name: "iPhone 17 notu",
    });
    await expect(fromPanel).toHaveValue("Menü çentiğin altında");
    await fromPanel.fill("Menü çentiğin altında kalıyor");
    await expect(inline).toHaveValue("Menü çentiğin altında kalıyor");
    await page.getByLabel("Genel not").fill("Genel olarak iyi");

    // Esc paneli kapatır, odak düğmeye döner
    await page.getByLabel("Genel not").press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(notesButton(page)).toBeFocused();

    // Aynı adres yeniden açılınca notlar geri gelir; başka adreste boş
    await page.reload();
    await openUrl(page);
    await notesButton(page).click();
    await expect(page.getByLabel("Genel not")).toHaveValue("Genel olarak iyi");
    await openUrl(page, "localhost:5174/baska.html");
    await expect(page.getByLabel("Genel not")).toHaveValue("");
});

test("ızgarada kutu notları ve panelde açık olmayan cihazların notları", async ({
    page,
}) => {
    await page.goto(APP_URL);
    await page.evaluate(
        (value) => localStorage.setItem("rc-grid", value),
        JSON.stringify({
            ids: ["iphone-17", "galaxy-s24"],
            mode: "grid",
            size: "medium",
        }),
    );
    await page.reload();
    await openUrl(page);
    const box = page.locator('#device-grid > li[data-grid-id="galaxy-s24"]');
    await box.getByRole("button", { name: "Galaxy S24 notu" }).click();
    await box
        .getByRole("textbox", { name: "Galaxy S24 notu" })
        .fill("Başlık iki satır");
    await notesButton(page).click();
    await expect(
        panel(page).locator("label").filter({ hasText: "notu" }),
    ).toHaveText(["iPhone 17 notu", "Galaxy S24 notu"]);

    // Izgaradan çıkarılan cihazın notu panelde kalır
    await page
        .getByRole("button", { name: "Galaxy S24 cihazını ızgaradan çıkar" })
        .first()
        .click();
    await expect(
        panel(page).getByRole("textbox", { name: "Galaxy S24 notu" }),
    ).toHaveValue("Başlık iki satır");
});

test("notlar temizlenir ve geri alınır", async ({ page }) => {
    await page.goto(APP_URL);
    await openUrl(page);
    await notesButton(page).click();
    await page.getByLabel("Genel not").fill("Silinecek not");
    await page.getByRole("button", { name: "Notları temizle" }).click();
    await expect(page.getByLabel("Genel not")).toHaveValue("");
    await expect(page.locator("#notes-cleared")).toHaveText(
        "Notlar temizlendi.",
    );
    await expect(page.locator("#app-status")).toHaveText("Notlar temizlendi.");
    const undo = page.getByRole("button", { name: "Geri al" });
    await expect(undo).toBeFocused();
    await undo.click();
    await expect(page.getByLabel("Genel not")).toHaveValue("Silinecek not");
    await expect(
        page.getByRole("button", { name: "Notları temizle" }),
    ).toBeVisible();
});

test("yüklenen projenin notları adresten ayrıdır", async ({ page }) => {
    await page.goto(APP_URL);
    await openUrl(page);
    await notesButton(page).click();
    await page.getByLabel("Genel not").fill("Adres notu");
    await page.getByRole("button", { name: "Notları kapat" }).click();
    await page.getByRole("button", { name: "Yükle" }).click();
    await page.locator("#file-input").setInputFiles({
        name: "kafe.zip",
        mimeType: "application/zip",
        buffer: Buffer.from(
            zipSync({ "index.html": strToU8("<!doctype html><h1>Kafe</h1>") }),
        ),
    });
    await expect(page.locator("#upload-dialog")).not.toBeVisible();
    await notesButton(page).click();
    await expect(page.getByLabel("Genel not")).toHaveValue("");
});

test("telefonda panel ekranın tamamını kaplar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(APP_URL);
    await openUrl(page);
    await notesButton(page).click();
    const box = await panel(page).boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: 375, height: 812 });
});

test("notlarda WCAG 2.1 AA ihlali yok", async ({ page }) => {
    await page.goto(APP_URL);
    await openUrl(page);
    await page.getByRole("button", { name: "iPhone 17 notu" }).click();
    await notesButton(page).click();
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
