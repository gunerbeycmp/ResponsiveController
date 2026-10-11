import { defineConfig } from "vite";

// Önizleme sitesi; araçtan farklı bir port = farklı origin, izolasyon için (R-37)
export default defineConfig({
    root: "preview",
    server: {
        port: 5174,
        strictPort: true,
        // /__rc/sw.js'in tüm siteyi (/) kontrol edebilmesi için gerekli
        headers: { "Service-Worker-Allowed": "/" },
    },
    build: { outDir: "../dist/preview", emptyOutDir: true },
});
