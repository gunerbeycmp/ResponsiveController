import { expect, test } from "@playwright/test";

const APP_URL = "http://localhost:5173/";
const PREVIEW = "http://localhost:5174";

// Aracın içinden köprüyü kullanarak örnek bir projeyi önizleme sitesine yükler
async function loadSampleProject(page) {
    await page.goto(APP_URL);
    await page.evaluate(async () => {
        const { createPreviewBridge } = await import("/src/upload/bridge.js");
        const encode = (text) => new TextEncoder().encode(text).buffer;
        window.__bridge = createPreviewBridge();
        await window.__bridge.loadProject(
            [
                {
                    path: "/index.html",
                    data: encode(
                        '<!doctype html><html lang="tr"><head><title>Test projesi</title><link rel="stylesheet" href="/assets/style.css"></head><body><h1>Test projesi</h1></body></html>',
                    ),
                },
                {
                    path: "/assets/style.css",
                    data: encode("h1 { color: rgb(255, 0, 0); }"),
                },
                {
                    path: "/hakkinda/index.html",
                    data: encode(
                        "<!doctype html><title>Hakkında</title><h1>Hakkında</h1>",
                    ),
                },
            ],
            "/index.html",
        );
    });
}

test("yüklenen proje önizleme sitesinin kökünden sunulur (Teknik Tasarım 3, 7.3)", async ({
    page,
    context,
}) => {
    await loadSampleProject(page);
    const preview = await context.newPage();

    await preview.goto(`${PREVIEW}/`);
    await expect(preview.locator("h1")).toHaveText("Test projesi");
    // Kökten başlayan /assets/style.css yolu doğru dosyayı buluyor
    await expect(preview.locator("h1")).toHaveCSS("color", "rgb(255, 0, 0)");

    const checks = await preview.evaluate(async () => {
        const css = await fetch("/assets/style.css");
        const missing = await fetch("/assets/yok.png");
        const own = await fetch("/__rc/core.js");
        return {
            cssType: css.headers.get("content-type"),
            missing: missing.status,
            own: own.status,
        };
    });
    expect(checks.cssType).toContain("text/css");
    expect(checks.missing).toBe(404);
    expect(checks.own).toBe(200);

    await preview.goto(`${PREVIEW}/hakkinda`);
    await expect(preview.locator("h1")).toHaveText("Hakkında");

    await preview.goto(`${PREVIEW}/olmayan/sayfa`);
    await expect(preview.locator("h1")).toHaveText("Test projesi");
});

test("araçtaki önizleme çerçevesinde de çalışır", async ({ page }) => {
    await loadSampleProject(page);
    await page.evaluate((url) => {
        document.getElementById("empty-state").hidden = true;
        document.getElementById("device-frame").hidden = false;
        document.getElementById("preview-iframe").src = url;
    }, `${PREVIEW}/`);
    await expect(page.frameLocator("#preview-iframe").locator("h1")).toHaveText(
        "Test projesi",
    );
});

test("proje kapatılınca önizleme sitesinin kendi sayfası döner (NFR-3.2)", async ({
    page,
    context,
}) => {
    await loadSampleProject(page);
    await page.evaluate(() => window.__bridge.clearProject());
    const preview = await context.newPage();
    await preview.goto(`${PREVIEW}/`);
    await expect(preview).toHaveTitle("ResponsiveController Preview");
});

test("köprü, aracın adresi dışından gelen mesajları yok sayar (R-37)", async ({
    page,
}) => {
    // Önizleme sitesinin kendisi (5174) köprüye proje göndermeye çalışıyor
    await page.goto(`${PREVIEW}/`);
    const stored = await page.evaluate(async () => {
        const frame = document.createElement("iframe");
        frame.src = "/__rc/bridge.html?app=http://localhost:5173";
        document.body.append(frame);
        await new Promise((resolve) => (frame.onload = resolve));
        await new Promise((resolve) => setTimeout(resolve, 300));
        frame.contentWindow.postMessage(
            {
                type: "rc:load",
                id: 1,
                entry: "/index.html",
                files: [
                    {
                        path: "/index.html",
                        data: new TextEncoder().encode("saldırı").buffer,
                    },
                ],
            },
            "*",
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const cache = await caches.open("rc-project-v1");
        return Boolean(await cache.match("/__rc/meta.json"));
    });
    expect(stored).toBe(false);
});

test("izin listesinde olmayan uygulama adresiyle köprü hiç yanıt vermez", async ({
    page,
}) => {
    await page.goto(`${PREVIEW}/`);
    const answered = await page.evaluate(async () => {
        let ready = false;
        window.addEventListener("message", (event) => {
            if (event.data?.type === "rc:ready") ready = true;
        });
        const frame = document.createElement("iframe");
        frame.src = "/__rc/bridge.html?app=https://kotu-site.example";
        document.body.append(frame);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return ready;
    });
    expect(answered).toBe(false);
});
