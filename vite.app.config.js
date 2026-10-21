import { defineConfig } from "vite";

// Aracın kendisi (Teknik Tasarım 5)
export default defineConfig({
    // İki sunucu ayrı önbellek kullanır; aynı klasörü paylaşınca biri
    // diğerinin bağımlılık listesini eziyordu ("504 Outdated Optimize Dep")
    cacheDir: "../node_modules/.vite/app",
    root: "app",
    server: { port: 5173, strictPort: true },
    build: { outDir: "../dist/app", emptyOutDir: true },
});
