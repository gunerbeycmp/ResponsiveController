import { defineConfig } from "vite";

// Aracın kendisi (Teknik Tasarım 5)
export default defineConfig({
    root: "app",
    server: { port: 5173, strictPort: true },
    build: { outDir: "../dist/app", emptyOutDir: true },
});
