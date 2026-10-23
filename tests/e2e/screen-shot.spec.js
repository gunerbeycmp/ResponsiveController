import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pickDevice } from "./menu.js";

const APP_URL = "http://localhost:5173/";
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
test.use({ locale: "tr-TR", viewport: { width: 1280, height: 800 } });

// Tarayıcının paylaşım penceresi otomatik testte açılamaz; getDisplayMedia
// yerine sekmeyle aynı oranda, düz renkli bir kare veren sahte akış konur.
// mode: "ok" | "denied" | "window" (başka pencere) | "none" (desteklenmiyor)
async function fakeShare(page, mode = "ok") {
    await page.addInitScript((mode) => {
        window.__shares = 0;
        if (mode === "none") {
            Object.defineProperty(navigator, "mediaDevices", {
                value: {},
                configurable: true,
            });
            return;
        }
        navigator.mediaDevices.getDisplayMedia = async () => {
            window.__shares += 1;
            // Kare alınırken çerçeve köşeleri düz mü
            window.__radius = getComputedStyle(
                document.querySelector("#frame-viewport"),
            ).borderTopLeftRadius;
            if (mode === "denied")
                throw new DOMException("denied", "NotAllowedError");
            const ratio = 2;
            const canvas = document.createElement("canvas");
            canvas.width = window.innerWidth * ratio;
            // Başka bir pencere: oran tutmaz
            canvas.height =
                window.innerHeight * ratio * (mode === "window" ? 0.5 : 1);
            const context = canvas.getContext("2d");
            context.fillStyle = "#00ff00";
            context.fillRect(0, 0, canvas.width, canvas.height);
            const stream = canvas.captureStream(30);
            window.__lastTrack = stream.getVideoTracks()[0];
            // Kareyi sürekli yenile (bazı tarayıcılar yalnızca değişimde kare verir)
            const timer = setInterval(() => {
                context.fillRect(0, 0, 1, 1);
            }, 30);
            window.__lastTrack.addEventListener("ended", () =>
                clearInterval(timer),
            );
            return stream;
        };
    }, mode);
}

async function openUrl(page, grid) {
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
}

const shotButton = (page) =>
    page.getByRole("button", { name: "iPhone 17 ekran görüntüsünü al" });

test("URL ile açılan sitede görünen alan ekran paylaşımıyla alınır (FR-4.2)", async ({
    page,
}) => {
    await fakeShare(page);
    await openUrl(page);
    await shotButton(page).click();
    const image = page.getByRole("img", {
        name: "iPhone 17 ekran görüntüsü (402 × 874)",
    });
    await expect(image).toBeVisible();
    // Ekran paylaşımında tam sayfa yok
    await expect(page.locator("#shot-modes")).toBeHidden();
    // Kesilen alan ekrandaki cihaz alanı × kare oranı (2)
    const [natural, onScreen] = await Promise.all([
        image.evaluate(async (img) => {
            await img.decode();
            return [img.naturalWidth, img.naturalHeight];
        }),
        page.locator("#frame-canvas").evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return [rect.width, rect.height];
        }),
    ]);
    expect(Math.abs(natural[0] - onScreen[0] * 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(natural[1] - onScreen[1] * 2)).toBeLessThanOrEqual(2);
    // Ölçek %100'ün altında: not
    await expect(page.locator("#shot-note-text")).toHaveText(
        /^Görüntü ekrandaki boyutunda \(%\d+\) alındı\. Daha keskin görüntü için ölçeği büyütüp tekrar dene\.$/,
    );
    // Paylaşım hemen kapatıldı
    expect(await page.evaluate(() => window.__lastTrack.readyState)).toBe(
        "ended",
    );
    // Kare alınırken köşeler düzdü, sonra eski hâline döndü
    expect(await page.evaluate(() => window.__radius)).toBe("0px");
    await expect(page.locator("#frame-viewport")).toHaveCSS(
        "border-top-left-radius",
        "12px",
    );
});

test("ölçek %100 iken not gösterilmez", async ({ page }) => {
    await fakeShare(page);
    await openUrl(page, {
        ids: [],
        mode: "single",
        size: "medium",
        scale: 1,
    });
    await page.getByRole("tab", { name: "Saat", exact: true }).click();
    await pickDevice(page, "galaxy-watch");
    await page
        .getByRole("button", { name: "Galaxy Watch ekran görüntüsünü al" })
        .click();
    await expect(page.locator("#shot-image")).toBeVisible();
    await expect(page.locator("#shot-note")).toBeHidden();
});

test("izin verilmezse açıklama gösterilir", async ({ page }) => {
    await fakeShare(page, "denied");
    await openUrl(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-status")).toHaveText(
        "Ekran paylaşımına izin verilmedi. Görüntü almak için tekrar dene ve paylaşıma izin ver.",
    );
    await expect(page.locator("#shot-actions")).toBeHidden();
});

test("başka bir pencere paylaşılırsa açıklama gösterilir", async ({ page }) => {
    await fakeShare(page, "window");
    await openUrl(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-status")).toHaveText(
        "Ekran görüntüsü için bu sekmeyi paylaşmalısın. Tekrar dene ve paylaşım penceresinde bu sekmeyi seç.",
    );
});

test("ekran paylaşımı desteklenmiyorsa açıklama gösterilir (NFR-1.3)", async ({
    page,
}) => {
    await fakeShare(page, "none");
    await openUrl(page);
    await expect(shotButton(page)).toBeVisible();
    await shotButton(page).click();
    await expect(page.locator("#shot-status")).toHaveText(
        "Bu tarayıcı ekran paylaşımını desteklemiyor (ör. iPhone ve iPad). URL ile açılan sitelerin ekran görüntüsü masaüstünde Chrome, Edge veya Firefox ile alınabilir.",
    );
});

test("ızgarada tek izinle bütün kutular alınır (FR-4.2, FR-4.4)", async ({
    page,
}) => {
    await fakeShare(page);
    await openUrl(page, {
        ids: ["iphone-17", "galaxy-s24"],
        mode: "grid",
        size: "medium",
    });
    await page.getByRole("button", { name: "Tümünün ekran görüntüsü" }).click();
    await expect(page.locator("#shot-parts img")).toHaveCount(2);
    expect(await page.evaluate(() => window.__shares)).toBe(1);
    await page.getByRole("button", { name: "Tek görsel (ızgara)" }).click();
    await expect(
        page.getByRole("img", { name: "Izgaranın ekran görüntüsü (2 cihaz)" }),
    ).toBeVisible();

    // Kutudaki 📷
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
    await page
        .locator('#device-grid > li[data-grid-id="galaxy-s24"]')
        .getByRole("button", { name: "Galaxy S24 ekran görüntüsünü al" })
        .click();
    await expect(
        page.getByRole("img", {
            name: "Galaxy S24 ekran görüntüsü (360 × 780)",
        }),
    ).toBeVisible();
});

test("ekran paylaşımı penceresinde WCAG 2.1 AA ihlali yok", async ({
    page,
}) => {
    await fakeShare(page);
    await openUrl(page);
    await shotButton(page).click();
    await expect(page.locator("#shot-image")).toBeVisible();
    const results = await new AxeBuilder({ page })
        .withTags(WCAG_21_AA)
        .analyze();
    expect(results.violations).toEqual([]);
});
