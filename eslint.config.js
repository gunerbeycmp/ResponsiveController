import js from "@eslint/js";
import globals from "globals";

// Teknik Tasarım 8: ESLint önerilen kurallar
export default [
    { ignores: ["dist/", "node_modules/"] },
    js.configs.recommended,
    {
        // Araç ve önizleme tarayıcıda çalışır
        files: ["app/**/*.js", "preview/**/*.js"],
        languageOptions: { globals: globals.browser },
    },
    {
        // Service Worker kendi ortamında çalışır (Teknik Tasarım 3)
        files: ["preview/sw.js"],
        languageOptions: { globals: globals.serviceworker },
    },
    {
        // Vite ve ESLint ayar dosyaları Node'da çalışır
        files: ["*.config.js"],
        languageOptions: { globals: globals.node },
    },
];
