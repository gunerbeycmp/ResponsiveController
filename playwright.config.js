import { defineConfig, devices } from "@playwright/test";

// Tarayıcı testleri tests/e2e altında tutulur (Teknik Tasarım 9, NFR-1.1)
export default defineConfig({
    testDir: "tests/e2e",
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        // WebKit macOS 26.0.1'de açılırken çöküyor (R-50, D-06); Safari şimdilik elle test edilir
        // { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
    // Testlerden önce araç ve önizleme sunucularını başlatır
    webServer: [
        {
            command: "npm run dev:app",
            url: "http://localhost:5173",
            reuseExistingServer: true,
        },
        {
            command: "npm run dev:preview",
            url: "http://localhost:5174",
            reuseExistingServer: true,
        },
    ],
});
