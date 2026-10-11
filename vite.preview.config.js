import { defineConfig } from "vite";

// Önizleme sitesi; araçtan farklı bir port = farklı origin, izolasyon için (R-37)
export default defineConfig({
    root: "preview",
    server: { port: 5174, strictPort: true },
    build: { outDir: "../dist/preview", emptyOutDir: true },
});
